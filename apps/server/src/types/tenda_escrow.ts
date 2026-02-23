/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/tenda_escrow.json`.
 */
export type TendaEscrow = {
  "address": "7H6AAoghUCPAVA1WTEwpSmkiRfPHWrgFidZQPzbXzkes",
  "metadata": {
    "name": "tendaEscrow",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Tenda Escrow Smart Contract"
  },
  "instructions": [
    {
      "name": "acceptGig",
      "discriminator": [
        94,
        129,
        189,
        107,
        220,
        74,
        82,
        57
      ],
      "accounts": [
        {
          "name": "gigEscrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "gig_escrow.gig_id",
                "account": "gigEscrow"
              }
            ]
          }
        },
        {
          "name": "workerAccount",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "worker"
              }
            ]
          }
        },
        {
          "name": "worker",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "airdropGasSubsidy",
      "discriminator": [
        12,
        67,
        136,
        81,
        143,
        201,
        48,
        51
      ],
      "accounts": [
        {
          "name": "userAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true
        },
        {
          "name": "treasury",
          "docs": [
            "Platform treasury that sends the airdrop"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "approveCompletion",
      "discriminator": [
        191,
        196,
        91,
        103,
        232,
        146,
        6,
        67
      ],
      "accounts": [
        {
          "name": "gigEscrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "gig_escrow.gig_id",
                "account": "gigEscrow"
              }
            ]
          }
        },
        {
          "name": "platformState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109
                ]
              }
            ]
          }
        },
        {
          "name": "workerAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "worker"
              }
            ]
          }
        },
        {
          "name": "poster",
          "writable": true,
          "signer": true
        },
        {
          "name": "worker",
          "writable": true
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "cancelGig",
      "discriminator": [
        109,
        142,
        65,
        80,
        226,
        145,
        135,
        185
      ],
      "accounts": [
        {
          "name": "gigEscrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "gig_escrow.gig_id",
                "account": "gigEscrow"
              }
            ]
          }
        },
        {
          "name": "poster",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "createGigEscrow",
      "discriminator": [
        193,
        117,
        69,
        70,
        18,
        123,
        67,
        33
      ],
      "accounts": [
        {
          "name": "gigEscrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "arg",
                "path": "gigId"
              }
            ]
          }
        },
        {
          "name": "platformState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109
                ]
              }
            ]
          }
        },
        {
          "name": "poster",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "gigId",
          "type": "string"
        },
        {
          "name": "paymentAmount",
          "type": "u64"
        },
        {
          "name": "completionDurationSeconds",
          "type": "u64"
        },
        {
          "name": "acceptDeadline",
          "type": {
            "option": "i64"
          }
        }
      ]
    },
    {
      "name": "createUserAccount",
      "discriminator": [
        146,
        68,
        100,
        69,
        63,
        46,
        182,
        199
      ],
      "accounts": [
        {
          "name": "userAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "disputeGig",
      "discriminator": [
        235,
        80,
        86,
        158,
        192,
        86,
        167,
        190
      ],
      "accounts": [
        {
          "name": "gigEscrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "gig_escrow.gig_id",
                "account": "gigEscrow"
              }
            ]
          }
        },
        {
          "name": "initiator",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "reason",
          "type": "string"
        }
      ]
    },
    {
      "name": "initializePlatform",
      "discriminator": [
        119,
        201,
        101,
        45,
        75,
        122,
        89,
        3
      ],
      "accounts": [
        {
          "name": "platformState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "treasury"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "platformFeeBps",
          "type": "u16"
        },
        {
          "name": "gracePeriodSeconds",
          "type": "i64"
        }
      ]
    },
    {
      "name": "refundExpired",
      "discriminator": [
        118,
        153,
        164,
        244,
        40,
        128,
        242,
        250
      ],
      "accounts": [
        {
          "name": "gigEscrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "gig_escrow.gig_id",
                "account": "gigEscrow"
              }
            ]
          }
        },
        {
          "name": "platformState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109
                ]
              }
            ]
          }
        },
        {
          "name": "poster",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "resolveDispute",
      "discriminator": [
        231,
        6,
        202,
        6,
        96,
        103,
        12,
        230
      ],
      "accounts": [
        {
          "name": "gigEscrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "gig_escrow.gig_id",
                "account": "gigEscrow"
              }
            ]
          }
        },
        {
          "name": "platformState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109
                ]
              }
            ]
          }
        },
        {
          "name": "workerAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "worker"
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true
        },
        {
          "name": "poster",
          "writable": true
        },
        {
          "name": "worker",
          "writable": true
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "winner",
          "type": {
            "defined": {
              "name": "disputeWinner"
            }
          }
        }
      ]
    },
    {
      "name": "submitProof",
      "discriminator": [
        54,
        241,
        46,
        84,
        4,
        212,
        46,
        94
      ],
      "accounts": [
        {
          "name": "gigEscrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "gig_escrow.gig_id",
                "account": "gigEscrow"
              }
            ]
          }
        },
        {
          "name": "platformState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109
                ]
              }
            ]
          }
        },
        {
          "name": "worker",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "withdrawEarnings",
      "discriminator": [
        6,
        132,
        233,
        254,
        241,
        87,
        247,
        185
      ],
      "accounts": [
        {
          "name": "userAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "gigEscrow",
      "discriminator": [
        28,
        152,
        50,
        155,
        169,
        194,
        206,
        20
      ]
    },
    {
      "name": "platformState",
      "discriminator": [
        160,
        10,
        182,
        134,
        98,
        122,
        78,
        239
      ]
    },
    {
      "name": "userAccount",
      "discriminator": [
        211,
        33,
        136,
        16,
        186,
        110,
        242,
        127
      ]
    }
  ],
  "events": [
    {
      "name": "disputeOpened",
      "discriminator": [
        239,
        222,
        102,
        235,
        193,
        85,
        1,
        214
      ]
    },
    {
      "name": "disputeResolved",
      "discriminator": [
        121,
        64,
        249,
        153,
        139,
        128,
        236,
        187
      ]
    },
    {
      "name": "earningsWithdrawn",
      "discriminator": [
        2,
        155,
        160,
        28,
        85,
        112,
        127,
        79
      ]
    },
    {
      "name": "gasSubsidyAirdropped",
      "discriminator": [
        187,
        53,
        103,
        186,
        251,
        132,
        247,
        164
      ]
    },
    {
      "name": "gigAccepted",
      "discriminator": [
        6,
        108,
        227,
        152,
        237,
        213,
        4,
        1
      ]
    },
    {
      "name": "gigCancelled",
      "discriminator": [
        125,
        193,
        224,
        148,
        176,
        113,
        250,
        18
      ]
    },
    {
      "name": "gigCompleted",
      "discriminator": [
        42,
        114,
        160,
        40,
        3,
        241,
        149,
        64
      ]
    },
    {
      "name": "gigCreated",
      "discriminator": [
        99,
        221,
        204,
        160,
        24,
        21,
        102,
        174
      ]
    },
    {
      "name": "gigExpired",
      "discriminator": [
        37,
        103,
        61,
        206,
        111,
        4,
        142,
        244
      ]
    },
    {
      "name": "platformInitialized",
      "discriminator": [
        16,
        222,
        212,
        5,
        213,
        140,
        112,
        162
      ]
    },
    {
      "name": "proofSubmitted",
      "discriminator": [
        160,
        51,
        85,
        70,
        249,
        89,
        5,
        139
      ]
    },
    {
      "name": "userAccountCreated",
      "discriminator": [
        16,
        133,
        225,
        182,
        145,
        219,
        182,
        3
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "platformFeeTooHigh",
      "msg": "Platform fee exceeds maximum allowed (5%)"
    },
    {
      "code": 6001,
      "name": "platformAlreadyInitialized",
      "msg": "Platform is already initialized"
    },
    {
      "code": 6002,
      "name": "userAccountAlreadyExists",
      "msg": "User account already exists"
    },
    {
      "code": 6003,
      "name": "alreadyReceivedAirdrop",
      "msg": "User has already received gas subsidy"
    },
    {
      "code": 6004,
      "name": "airdropAmountTooHigh",
      "msg": "Airdrop amount exceeds maximum allowed"
    },
    {
      "code": 6005,
      "name": "insufficientBalance",
      "msg": "Insufficient balance to withdraw"
    },
    {
      "code": 6006,
      "name": "airdropStillLocked",
      "msg": "Must complete at least 1 gig to unlock airdrop"
    },
    {
      "code": 6007,
      "name": "userAccountNotFound",
      "msg": "User account does not exist"
    },
    {
      "code": 6008,
      "name": "paymentTooLow",
      "msg": "Payment amount below minimum"
    },
    {
      "code": 6009,
      "name": "invalidDeadline",
      "msg": "Deadline must be in the future"
    },
    {
      "code": 6010,
      "name": "acceptDeadlinePassed",
      "msg": "Accept deadline has passed"
    },
    {
      "code": 6011,
      "name": "durationTooShort",
      "msg": "Completion duration is below minimum allowed"
    },
    {
      "code": 6012,
      "name": "durationTooLong",
      "msg": "Completion duration exceeds maximum allowed"
    },
    {
      "code": 6013,
      "name": "gigIdTooLong",
      "msg": "Gig ID is too long"
    },
    {
      "code": 6014,
      "name": "insufficientFunds",
      "msg": "Insufficient funds for escrow deposit"
    },
    {
      "code": 6015,
      "name": "invalidGigStatus",
      "msg": "Invalid gig status for this operation"
    },
    {
      "code": 6016,
      "name": "notPoster",
      "msg": "Caller is not the poster"
    },
    {
      "code": 6017,
      "name": "notWorker",
      "msg": "Caller is not the worker"
    },
    {
      "code": 6018,
      "name": "cannotAcceptOwnGig",
      "msg": "Cannot accept own gig"
    },
    {
      "code": 6019,
      "name": "gigNotOpen",
      "msg": "Gig is not open for acceptance"
    },
    {
      "code": 6020,
      "name": "gigNotAccepted",
      "msg": "Gig has not been accepted yet"
    },
    {
      "code": 6021,
      "name": "proofNotSubmitted",
      "msg": "Proof has not been submitted"
    },
    {
      "code": 6022,
      "name": "gigNotExpired",
      "msg": "Gig has not expired yet"
    },
    {
      "code": 6023,
      "name": "cannotRefundWithProof",
      "msg": "Cannot refund gig with submitted proof"
    },
    {
      "code": 6024,
      "name": "submissionDeadlinePassed",
      "msg": "Submission deadline has passed"
    },
    {
      "code": 6025,
      "name": "disputeReasonTooLong",
      "msg": "Dispute reason is too long"
    },
    {
      "code": 6026,
      "name": "cannotDispute",
      "msg": "Cannot dispute gig in current status"
    },
    {
      "code": 6027,
      "name": "notAuthorizedToDispute",
      "msg": "Caller is not authorized to dispute"
    },
    {
      "code": 6028,
      "name": "gigNotDisputed",
      "msg": "Gig is not disputed"
    },
    {
      "code": 6029,
      "name": "notAdmin",
      "msg": "Caller is not admin"
    },
    {
      "code": 6030,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6031,
      "name": "arithmeticUnderflow",
      "msg": "Arithmetic underflow"
    }
  ],
  "types": [
    {
      "name": "disputeOpened",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "gigId",
            "type": "string"
          },
          {
            "name": "initiator",
            "type": "pubkey"
          },
          {
            "name": "reason",
            "type": "string"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "disputeResolved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "gigId",
            "type": "string"
          },
          {
            "name": "winner",
            "type": "string"
          },
          {
            "name": "posterPayout",
            "type": "u64"
          },
          {
            "name": "workerPayout",
            "type": "u64"
          },
          {
            "name": "platformFee",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "disputeWinner",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "poster"
          },
          {
            "name": "worker"
          },
          {
            "name": "split"
          }
        ]
      }
    },
    {
      "name": "earningsWithdrawn",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "remainingBalance",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "gasSubsidyAirdropped",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "gigAccepted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "gigId",
            "type": "string"
          },
          {
            "name": "poster",
            "type": "pubkey"
          },
          {
            "name": "worker",
            "type": "pubkey"
          },
          {
            "name": "completionDeadline",
            "type": "i64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "gigCancelled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "gigId",
            "type": "string"
          },
          {
            "name": "poster",
            "type": "pubkey"
          },
          {
            "name": "refundAmount",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "gigCompleted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "gigId",
            "type": "string"
          },
          {
            "name": "poster",
            "type": "pubkey"
          },
          {
            "name": "worker",
            "type": "pubkey"
          },
          {
            "name": "paymentAmount",
            "type": "u64"
          },
          {
            "name": "platformFee",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "gigCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "gigId",
            "type": "string"
          },
          {
            "name": "poster",
            "type": "pubkey"
          },
          {
            "name": "paymentAmount",
            "type": "u64"
          },
          {
            "name": "platformFee",
            "type": "u64"
          },
          {
            "name": "completionDurationSeconds",
            "type": "u64"
          },
          {
            "name": "acceptDeadline",
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "gigEscrow",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "gigId",
            "docs": [
              "Unique gig identifier (UUID from backend)"
            ],
            "type": "string"
          },
          {
            "name": "poster",
            "docs": [
              "Poster wallet address"
            ],
            "type": "pubkey"
          },
          {
            "name": "worker",
            "docs": [
              "Worker wallet address (None until accepted)"
            ],
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "paymentAmount",
            "docs": [
              "Gig payment in lamports"
            ],
            "type": "u64"
          },
          {
            "name": "platformFee",
            "docs": [
              "Platform fee in lamports"
            ],
            "type": "u64"
          },
          {
            "name": "totalLocked",
            "docs": [
              "Total locked in escrow (payment + fee)"
            ],
            "type": "u64"
          },
          {
            "name": "acceptDeadline",
            "docs": [
              "Optional hard cutoff for worker acceptance (Unix timestamp).",
              "None means the gig is indefinitely open until poster cancels."
            ],
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "completionDurationSeconds",
            "docs": [
              "How long (in seconds) the worker has to complete after accepting."
            ],
            "type": "u64"
          },
          {
            "name": "completionDeadline",
            "docs": [
              "Computed at acceptance: accepted_at + completion_duration_seconds.",
              "None until a worker accepts the gig."
            ],
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "createdAt",
            "docs": [
              "When gig escrow was created (gig published)"
            ],
            "type": "i64"
          },
          {
            "name": "acceptedAt",
            "docs": [
              "When worker accepted gig"
            ],
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "submittedAt",
            "docs": [
              "When proof was submitted"
            ],
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "completedAt",
            "docs": [
              "When payment was released"
            ],
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "status",
            "docs": [
              "Current gig status"
            ],
            "type": {
              "defined": {
                "name": "gigStatus"
              }
            }
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump seed"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "gigExpired",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "gigId",
            "type": "string"
          },
          {
            "name": "poster",
            "type": "pubkey"
          },
          {
            "name": "refundAmount",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "gigStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "open"
          },
          {
            "name": "accepted"
          },
          {
            "name": "submitted"
          },
          {
            "name": "completed"
          },
          {
            "name": "disputed"
          },
          {
            "name": "resolved"
          },
          {
            "name": "cancelled"
          },
          {
            "name": "expired"
          }
        ]
      }
    },
    {
      "name": "platformInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "platformFeeBps",
            "type": "u16"
          },
          {
            "name": "gracePeriodSeconds",
            "type": "i64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "platformState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "docs": [
              "Platform admin wallet"
            ],
            "type": "pubkey"
          },
          {
            "name": "platformFeeBps",
            "docs": [
              "Platform fee in basis points (e.g., 200 = 2%)"
            ],
            "type": "u16"
          },
          {
            "name": "treasury",
            "docs": [
              "Platform treasury for collecting fees"
            ],
            "type": "pubkey"
          },
          {
            "name": "totalGigs",
            "docs": [
              "Total number of gigs created"
            ],
            "type": "u64"
          },
          {
            "name": "totalVolume",
            "docs": [
              "Total volume processed in lamports"
            ],
            "type": "u64"
          },
          {
            "name": "gracePeriodSeconds",
            "docs": [
              "Grace period after deadline in seconds (default: 86400 = 24h)"
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "proofSubmitted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "gigId",
            "type": "string"
          },
          {
            "name": "worker",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "userAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wallet",
            "docs": [
              "User wallet address"
            ],
            "type": "pubkey"
          },
          {
            "name": "airdropSol",
            "docs": [
              "Locked airdrop SOL (unlocks after 1 completed gig)"
            ],
            "type": "u64"
          },
          {
            "name": "earnedSol",
            "docs": [
              "Withdrawable earned SOL"
            ],
            "type": "u64"
          },
          {
            "name": "completedGigs",
            "docs": [
              "Total completed gigs"
            ],
            "type": "u32"
          },
          {
            "name": "phoneVerified",
            "docs": [
              "Phone verification status"
            ],
            "type": "bool"
          },
          {
            "name": "createdAt",
            "docs": [
              "Account creation timestamp"
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "userAccountCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "escrowSeed",
      "type": "bytes",
      "value": "[101, 115, 99, 114, 111, 119]"
    },
    {
      "name": "platformSeed",
      "type": "bytes",
      "value": "[112, 108, 97, 116, 102, 111, 114, 109]"
    },
    {
      "name": "userSeed",
      "type": "bytes",
      "value": "[117, 115, 101, 114]"
    }
  ]
};
