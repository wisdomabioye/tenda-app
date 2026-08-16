/**
 * Message-attachment vocabulary — web mirror of mobile's lib/attachments:
 * the wire/store type (shared `MessageAttachmentType`, 'image' | 'file')
 * bridged to the browser's File on the way in and the viewer on the way
 * out, so the mapping lives in one tested place instead of ad-hoc
 * ternaries. Shared by the chat thread now and the dispute thread (S6.1).
 */
import type { MessageAttachmentType } from '@tenda/shared'

/** An already-uploaded Cloudinary attachment, ready to ride along with a message. */
export interface UploadedAttachment {
  url: string
  type: MessageAttachmentType
  size: number
}

/**
 * Payload a message bubble emits when its attachment is clicked. The screen
 * turns it into a viewer item (image lightbox, or a new tab for documents).
 */
export interface AttachmentPress {
  id: string
  url: string
  type: MessageAttachmentType
}

/** Picked browser File → stored attachment type (anything non-image is a 'file'/PDF). */
export function fileToAttachmentType(file: File): MessageAttachmentType {
  return file.type.startsWith('image/') ? 'image' : 'file'
}
