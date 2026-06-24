-- 修复闪卡进度表的 RLS 策略，允许后端使用 anon key 插入和更新数据
DROP POLICY IF EXISTS "flashcard_progress_select_policy" ON flashcard_progress;
DROP POLICY IF EXISTS "flashcard_progress_insert_policy" ON flashcard_progress;
DROP POLICY IF EXISTS "flashcard_progress_update_policy" ON flashcard_progress;
DROP POLICY IF EXISTS "flashcard_progress_delete_policy" ON flashcard_progress;

CREATE POLICY "flashcard_progress_select_policy" 
  ON flashcard_progress FOR SELECT 
  TO public 
  USING (true);

CREATE POLICY "flashcard_progress_insert_policy" 
  ON flashcard_progress FOR INSERT 
  TO public 
  WITH CHECK (true);

CREATE POLICY "flashcard_progress_update_policy" 
  ON flashcard_progress FOR UPDATE 
  TO public 
  USING (true);

CREATE POLICY "flashcard_progress_delete_policy" 
  ON flashcard_progress FOR DELETE 
  TO public 
  USING (true);
