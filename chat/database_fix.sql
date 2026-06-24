-- 修复字典缓存表的 RLS 策略，允许使用 anon key 插入数据
CREATE POLICY "dictionary_cache_insert_policy" 
  ON dictionary_cache FOR INSERT 
  TO public 
  WITH CHECK (true);

CREATE POLICY "dictionary_cache_update_policy" 
  ON dictionary_cache FOR UPDATE 
  TO public 
  USING (true);
