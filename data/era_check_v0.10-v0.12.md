# v0.10–v0.12 新卡年代細節核對（數據研究員，2026-10-12）

對照世代：出生 1991–2000（民國 80–89），18–22 歲約 2009–2022。只列問題，不改卡。

## 需要注意（1 項）
1. `adult_first_salary_01` 的「薪餉」，以及 `military_first` 路線整體：兵役制度依出生年不同。
   - 1993 年（民國 82 年）以前出生的人當 1 年義務役。
   - 1994 年（民國 83 年）以後出生的人，在本遊戲年代裡是 4 個月的軍事訓練役。
   - 兩者都有按月薪餉，所以卡片文字成立。但 1994 年以後出生的人服役只有 4 個月，「第一份錢」是很短的一筆。
   - 若之後要寫兵役長度或金額，需依出生年分流（實際金額我還沒找到官方來源，暫不提供數字）。
   - 另外，女性不服義務役，這和 Jade 尚未決定的「兵役路線分性別」直接相關。

## 確認無問題（13 張）
- `senior_jc_scooter_01`：18 歲才可考普通重型機車駕照，卡片 age 18 正確。
- `senior_voc_work_night_shift_01`：勞基法第 48 條只規定童工（15–16 歲）不得在 20:00–06:00 工作（2026-10-17 更正：原寫「未滿 18 歲、22:00–06:00」有誤）；建教生另依《建教生權益保障法》第 24 條，不分年齡 20:00 後不得訓練。本卡 age_min 是 18、不是建教生，所以合法。
  （提醒：`senior_jc_five_years_work_01` 的年齡範圍是 16–18，這張卡和之後的卡都不要寫未滿 18 歲的人上大夜班。）
- `adult_uni_top_allnighter_01`：便利商店座位區和系上 FB 社團在 2010 年代都很普及。2009–2010 年剛滿 19 歲的人可能稍早一些，但可以接受。
- `adult_first_salary_parttime_01`：時薪換「便當加飲料」先前已經核對並採用。
- 以下都無年代問題：`senior_jc_reunion_01`、`senior_jc_license_01`、`senior_jc_student_or_not_01`、`senior_voc_work_senior_staff_01`、`senior_voc_work_summer_01`、`senior_voc_work_payslip_01`、`adult_uni_top_lab_senior_01`、`adult_uni_top_exchange_01`、`senior_jc_five_years_work_01`。
