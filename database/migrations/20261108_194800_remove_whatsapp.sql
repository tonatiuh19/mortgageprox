UPDATE `conversation_threads` SET `channel` = 'note' WHERE `channel` = 'whatsapp';
UPDATE `conversation_messages` SET `channel` = 'note' WHERE `channel` = 'whatsapp';

ALTER TABLE `conversation_threads`
  MODIFY COLUMN `channel` ENUM('sms','email','call','note') NOT NULL DEFAULT 'note';

ALTER TABLE `conversation_messages`
  MODIFY COLUMN `channel` ENUM('sms','email','call','note') NOT NULL;
