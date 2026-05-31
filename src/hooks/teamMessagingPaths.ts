interface MessageAttachmentPathInput {
  conversationId: string;
  userId: string;
  fileName: string;
}

const sanitizeFileName = (fileName: string) =>
  fileName.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "attachment";

export const buildMessageAttachmentPath = ({
  conversationId,
  userId,
  fileName,
}: MessageAttachmentPathInput) =>
  `${conversationId}/${userId}/${Date.now()}-${sanitizeFileName(fileName)}`;
