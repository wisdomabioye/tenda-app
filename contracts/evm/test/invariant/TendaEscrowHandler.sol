// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TendaEscrow} from "../../src/TendaEscrow.sol";
import {MockUSDCPermitV2} from "../mocks/MockUSDCPermitV2.sol";
import {TendaEscrowHandlerBase} from "./TendaEscrowHandlerBase.sol";

/// @dev Invariant handler: every externally-reachable state transition —
///      including BOTH EIP-2612 permit entry points, front-run-consumed
///      permits (the try/catch griefing path), and mid-flight admin
///      parameter changes — as bounded, always-valid actions. The suite
///      runs with fail_on_revert=true, so any revert the handler did not
///      explicitly expect is itself a finding.
contract TendaEscrowHandler is TendaEscrowHandlerBase {
    constructor(TendaEscrow e, MockUSDCPermitV2 t, address a, address d, address tr)
        TendaEscrowHandlerBase(e, t, a, d, tr)
    {}

    // ---------------------------------------------------------------------
    // Create (plain, native, permit, griefed permit)
    // ---------------------------------------------------------------------

    struct CreateArgs {
        uint256 amount;
        uint256 bond;
        uint64 acceptWindow;
        uint64 duration;
        uint8 kind;
        bool isSeeker;
        address assigned;
        uint64 acceptDeadline;
    }

    function _boundCreate(
        uint256 amount,
        uint256 bond,
        uint64 acceptWindow,
        uint64 duration,
        uint8 kind,
        uint256 assignSeed
    ) private view returns (CreateArgs memory c) {
        c.amount = bound(amount, 1, MAX_AMOUNT);
        c.bond = bound(bond, 0, MAX_AMOUNT);
        c.acceptWindow = uint64(bound(acceptWindow, 1 hours, 30 days));
        c.duration = uint64(
            bound(duration, escrowC.MIN_COMPLETION_DURATION_SECONDS(), escrowC.MAX_COMPLETION_DURATION_SECONDS())
        );
        c.kind = kind % 2;
        c.isSeeker = assignSeed % 3 == 0;
        // A third of escrows are assigned to a specific actor.
        (, address assignee) = _actor(assignSeed);
        c.assigned = assignSeed % 3 == 1 ? assignee : address(0);
        c.acceptDeadline = uint64(block.timestamp) + c.acceptWindow;
    }

    function createERC20(
        uint256 actorSeed,
        uint256 amount,
        uint256 bond,
        uint64 aw,
        uint64 dur,
        uint8 kind,
        uint256 aSeed
    ) external {
        (, address creator) = _actor(actorSeed);
        CreateArgs memory c = _boundCreate(amount, bond, aw, dur, kind, aSeed);
        if (c.assigned == creator) c.assigned = address(0);
        bytes16 id = _nextId();
        vm.startPrank(creator);
        token.approve(address(escrowC), c.amount);
        escrowC.createEscrow(
            id, c.kind, address(token), c.amount, c.assigned, c.acceptDeadline, c.duration, c.bond, c.isSeeker
        );
        vm.stopPrank();
        _recordCreate(id, true, c.amount, c.bond, creator, c.assigned, c.isSeeker, c.acceptDeadline, c.duration);
    }

    function createNative(
        uint256 actorSeed,
        uint256 amount,
        uint256 bond,
        uint64 aw,
        uint64 dur,
        uint8 kind,
        uint256 aSeed
    ) external {
        (, address creator) = _actor(actorSeed);
        CreateArgs memory c = _boundCreate(amount, bond, aw, dur, kind, aSeed);
        if (c.assigned == creator) c.assigned = address(0);
        bytes16 id = _nextId();
        vm.prank(creator);
        escrowC.createEscrow{value: c.amount}(
            id, c.kind, address(0), c.amount, c.assigned, c.acceptDeadline, c.duration, c.bond, c.isSeeker
        );
        _recordCreate(id, false, c.amount, c.bond, creator, c.assigned, c.isSeeker, c.acceptDeadline, c.duration);
    }

    /// @dev Happy permit — value may exceed the amount (over-permit) so the
    ///      run accumulates realistic residual allowances, which must never
    ///      affect solvency.
    function createWithPermit(
        uint256 actorSeed,
        uint256 amount,
        uint256 over,
        uint64 aw,
        uint64 dur,
        uint8 kind,
        uint256 aSeed
    ) external {
        (uint256 pk, address creator) = _actor(actorSeed);
        CreateArgs memory c = _boundCreate(amount, 0, aw, dur, kind, aSeed);
        if (c.assigned == creator) c.assigned = address(0);
        uint256 value = c.amount + bound(over, 0, MAX_AMOUNT);
        TendaEscrow.Permit memory p = _signPermit(pk, creator, value, block.timestamp + 15 minutes);
        bytes16 id = _nextId();
        vm.prank(creator);
        escrowC.createEscrowWithPermit(
            id, c.kind, address(token), c.amount, c.assigned, c.acceptDeadline, c.duration, c.bond, c.isSeeker, p
        );
        _recordCreate(id, true, c.amount, c.bond, creator, c.assigned, c.isSeeker, c.acceptDeadline, c.duration);
    }

    /// @dev The griefing scenario the try/catch exists for: a front-runner
    ///      lifts the signature and consumes it via token.permit directly;
    ///      the victim's createEscrowWithPermit must STILL succeed because
    ///      the allowance is already in place when the inner permit reverts.
    function createWithFrontRunPermit(
        uint256 actorSeed,
        uint256 amount,
        uint64 aw,
        uint64 dur,
        uint8 kind,
        uint256 aSeed
    ) external {
        (uint256 pk, address creator) = _actor(actorSeed);
        CreateArgs memory c = _boundCreate(amount, 0, aw, dur, kind, aSeed);
        if (c.assigned == creator) c.assigned = address(0);
        TendaEscrow.Permit memory p = _signPermit(pk, creator, c.amount, block.timestamp + 15 minutes);
        token.permit(creator, address(escrowC), p.value, p.deadline, p.v, p.r, p.s); // front-runner, any sender
        bytes16 id = _nextId();
        vm.prank(creator);
        escrowC.createEscrowWithPermit(
            id, c.kind, address(token), c.amount, c.assigned, c.acceptDeadline, c.duration, 0, c.isSeeker, p
        );
        _recordCreate(id, true, c.amount, 0, creator, c.assigned, c.isSeeker, c.acceptDeadline, c.duration);
    }

    /// @dev Garbage permit + no standing allowance: the swallowed permit
    ///      must NOT mint funds out of thin air — transferFrom reverts and
    ///      no escrow (or liability) may come into existence.
    function createWithGarbagePermit(uint256 actorSeed, uint256 amount, uint64 aw, uint64 dur, uint8 kind) external {
        (, address creator) = _actor(actorSeed);
        CreateArgs memory c = _boundCreate(amount, 0, aw, dur, kind, 2); // never assigned
        vm.startPrank(creator);
        token.approve(address(escrowC), 0); // ensure no residual allowance rescues it
        TendaEscrow.Permit memory p = TendaEscrow.Permit({
            value: c.amount,
            deadline: block.timestamp + 15 minutes,
            v: 27,
            r: bytes32(uint256(1)),
            s: bytes32(uint256(2))
        });
        bytes16 id = _nextId();
        vm.expectRevert();
        escrowC.createEscrowWithPermit(
            id, c.kind, address(token), c.amount, address(0), c.acceptDeadline, c.duration, 0, c.isSeeker, p
        );
        vm.stopPrank();
        // Deliberately NOT recorded: nothing was created.
    }

    // ---------------------------------------------------------------------
    // Open-state transitions
    // ---------------------------------------------------------------------

    function acceptEscrow(uint256 seed, uint256 actorSeed) external {
        bytes16 id = _pick(seed, TendaEscrow.Status.Open);
        if (id == bytes16(0)) return;
        Ghost storage g = ghosts[id];
        if (block.timestamp >= g.acceptDeadline) return; // organically expired
        (, address who) = _actor(actorSeed);
        if (g.assigned != address(0)) who = g.assigned;
        else if (who == g.creator) who = actors[(actorSeed + 1) % ACTOR_COUNT];
        if (who == g.creator) return;
        vm.prank(who);
        escrowC.acceptEscrow(id);
        g.status = TendaEscrow.Status.Accepted;
        g.counterparty = who;
        g.completionDeadline = uint64(block.timestamp) + g.duration;
    }

    function declineAssigned(uint256 seed) external {
        bytes16 id = _pick(seed, TendaEscrow.Status.Open);
        if (id == bytes16(0)) return;
        Ghost storage g = ghosts[id];
        if (g.assigned == address(0)) return;
        vm.prank(g.assigned);
        escrowC.declineAssignedEscrow(id);
        g.assigned = address(0); // stays Open, now public
    }

    function cancelEscrow(uint256 seed) external {
        bytes16 id = _pick(seed, TendaEscrow.Status.Open);
        if (id == bytes16(0)) return;
        Ghost storage g = ghosts[id];
        vm.prank(g.creator);
        escrowC.cancelEscrow(id);
        _recordPrincipalOut(g, TendaEscrow.Status.Cancelled);
    }

    function refundExpired(uint256 seed) external {
        bytes16 id = _pick(seed, TendaEscrow.Status.Open);
        if (id == bytes16(0)) return;
        Ghost storage g = ghosts[id];
        if (block.timestamp < g.acceptDeadline) vm.warp(g.acceptDeadline);
        vm.prank(g.creator);
        escrowC.refundExpired(id);
        _recordPrincipalOut(g, TendaEscrow.Status.Refunded);
    }

    // ---------------------------------------------------------------------
    // Accepted / Submitted transitions
    // ---------------------------------------------------------------------

    function submitProof(uint256 seed, bytes32 proofHash) external {
        bytes16 id = _pick(seed, TendaEscrow.Status.Accepted);
        if (id == bytes16(0)) return;
        Ghost storage g = ghosts[id];
        uint64 approvalWindow = escrowC.approvalWindowSeconds();
        if (block.timestamp >= g.completionDeadline + escrowC.gracePeriodSeconds()) return; // window closed
        vm.prank(g.counterparty);
        escrowC.submitProof(id, proofHash);
        g.status = TendaEscrow.Status.Submitted;
        g.approvalDeadline = uint64(block.timestamp) + approvalWindow;
    }

    function reclaimAbandoned(uint256 seed) external {
        bytes16 id = _pick(seed, TendaEscrow.Status.Accepted);
        if (id == bytes16(0)) return;
        Ghost storage g = ghosts[id];
        uint64 openAt = g.completionDeadline + escrowC.gracePeriodSeconds();
        if (block.timestamp < openAt) vm.warp(openAt);
        vm.prank(g.creator);
        escrowC.reclaimAbandoned(id);
        _recordPrincipalOut(g, TendaEscrow.Status.Refunded);
    }

    function approveCompletion(uint256 seed) external {
        bytes16 id = _pick(seed, TendaEscrow.Status.Submitted);
        if (id == bytes16(0)) return;
        Ghost storage g = ghosts[id];
        vm.prank(g.creator);
        escrowC.approveCompletion(id);
        _recordSettlement(g);
    }

    function claimStalled(uint256 seed) external {
        bytes16 id = _pick(seed, TendaEscrow.Status.Submitted);
        if (id == bytes16(0)) return;
        Ghost storage g = ghosts[id];
        if (block.timestamp < g.approvalDeadline) vm.warp(g.approvalDeadline);
        vm.prank(g.counterparty);
        escrowC.claimStalledPayment(id);
        _recordSettlement(g);
    }

    // ---------------------------------------------------------------------
    // Disputes (plain, permit, front-run permit) + resolution
    // ---------------------------------------------------------------------

    function _disputeTarget(uint256 seed, uint256 raiserSeed, bool wantErc20)
        private
        view
        returns (bytes16 id, address raiser)
    {
        id = _pick(seed, seed % 2 == 0 ? TendaEscrow.Status.Accepted : TendaEscrow.Status.Submitted);
        if (id == bytes16(0)) return (bytes16(0), address(0));
        Ghost storage g = ghosts[id];
        if (g.erc20 != wantErc20) return (bytes16(0), address(0));
        raiser = raiserSeed % 2 == 0 ? g.creator : g.counterparty;
    }

    function disputeNative(uint256 seed, uint256 raiserSeed) external {
        (bytes16 id, address raiser) = _disputeTarget(seed, raiserSeed, false);
        if (id == bytes16(0)) return;
        Ghost storage g = ghosts[id];
        vm.prank(raiser);
        escrowC.disputeEscrow{value: g.bond}(id);
        _recordDispute(g, raiser);
    }

    function disputeERC20(uint256 seed, uint256 raiserSeed) external {
        (bytes16 id, address raiser) = _disputeTarget(seed, raiserSeed, true);
        if (id == bytes16(0)) return;
        Ghost storage g = ghosts[id];
        vm.startPrank(raiser);
        token.approve(address(escrowC), g.bond);
        escrowC.disputeEscrow(id);
        vm.stopPrank();
        _recordDispute(g, raiser);
    }

    function disputeWithPermit(uint256 seed, uint256 raiserSeed) external {
        (bytes16 id, address raiser) = _disputeTarget(seed, raiserSeed, true);
        if (id == bytes16(0)) return;
        Ghost storage g = ghosts[id];
        TendaEscrow.Permit memory p = _signPermit(_keyOf(raiser), raiser, g.bond, block.timestamp + 15 minutes);
        vm.prank(raiser);
        escrowC.disputeEscrowWithPermit(id, p);
        _recordDispute(g, raiser);
    }

    function disputeWithFrontRunPermit(uint256 seed, uint256 raiserSeed) external {
        (bytes16 id, address raiser) = _disputeTarget(seed, raiserSeed, true);
        if (id == bytes16(0)) return;
        Ghost storage g = ghosts[id];
        TendaEscrow.Permit memory p = _signPermit(_keyOf(raiser), raiser, g.bond, block.timestamp + 15 minutes);
        token.permit(raiser, address(escrowC), p.value, p.deadline, p.v, p.r, p.s); // consume the nonce
        vm.prank(raiser);
        escrowC.disputeEscrowWithPermit(id, p); // swallowed permit + standing allowance → must land
        _recordDispute(g, raiser);
    }

    function resolveDispute(uint256 seed, uint8 winner) external {
        bytes16 id = _pick(seed, TendaEscrow.Status.Disputed);
        if (id == bytes16(0)) return;
        Ghost storage g = ghosts[id];
        winner = winner % 3;
        vm.prank(disputeAdmin);
        escrowC.resolveDispute(id, winner);
        _recordResolve(g, winner);
    }

    // ---------------------------------------------------------------------
    // Admin parameter changes + time
    // ---------------------------------------------------------------------

    function setFees(uint16 fee, uint16 seekerFee) external {
        fee = uint16(bound(fee, 0, escrowC.MAX_PLATFORM_FEE_BPS()));
        // Anchor-parity rule: seeker fee never exceeds the standard fee.
        seekerFee = uint16(bound(seekerFee, 0, fee));
        vm.prank(admin);
        escrowC.setFeeBps(fee, seekerFee);
    }

    function setWindows(uint64 approvalWindow, uint64 grace) external {
        approvalWindow =
            uint64(bound(approvalWindow, escrowC.MIN_APPROVAL_WINDOW_SECONDS(), escrowC.MAX_APPROVAL_WINDOW_SECONDS()));
        grace = uint64(bound(grace, 0, escrowC.MAX_GRACE_PERIOD_SECONDS()));
        vm.startPrank(admin);
        escrowC.setApprovalWindow(approvalWindow);
        escrowC.setGracePeriod(grace);
        vm.stopPrank();
    }

    function warpForward(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 1 hours, 30 days));
    }

    function _keyOf(address who) private view returns (uint256) {
        for (uint256 i = 0; i < ACTOR_COUNT; i++) {
            if (actors[i] == who) return actorKeys[i];
        }
        revert("unknown actor");
    }
}
