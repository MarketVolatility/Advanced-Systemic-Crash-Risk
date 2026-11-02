import importlib.util, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('cp',Path(__file__).resolve().parents[1]/'historical-data/update_commercial_paper.py')
cp=importlib.util.module_from_spec(spec);spec.loader.exec_module(cp)
class UpdateTests(unittest.TestCase):
 def test_missing_and_units(self):
  self.assertEqual(cp.parse_observations({'count':2,'observations':[{'date':'2026-09-21','value':'4.07'},{'date':'2026-09-22','value':'.'}]},'2026-09-01','2026-09-24'),{'2026-09-21':4.07,'2026-09-22':None})
 def test_incomplete_and_invalid(self):
  for payload in [{'count':2,'observations':[{'date':'2026-09-21','value':'4'}]},{'observations':[{'date':'2026-09-21','value':'NaN'}]},{'observations':[{'date':'2026-09-26','value':'4'}]}]:
   with self.assertRaises(ValueError):cp.parse_observations(payload,'2026-09-01','2026-09-24')
 def test_same_date_join(self):
  data={'DCPF3M':{'2026-09-21':4.07},'DCPN3M':{'2026-09-22':4.08},'DTB3':{'2026-09-21':4.02}}
  self.assertEqual(cp.merge_series(data),[['2026-09-21',4.07,None,4.02],['2026-09-22',None,4.08,None]])
 def test_only_cp_block_changes(self):
  original='const commercialPaperDaily = [];\nconst marketHistoryReference = [1];\n<span id="cpDownloadStatus">old</span>'
  new=cp.update_html(original,[['2026-09-21',4.07,4.08,4.02]],'2026-09-25T00:00:00+00:00')
  self.assertIn('const marketHistoryReference = [1];',new);self.assertIn('latest paired CP observation 2026-09-21',new)
  with self.assertRaises(ValueError):cp.update_html(original+'\nconst commercialPaperDaily = [];',[],'now')
if __name__=='__main__':unittest.main()
