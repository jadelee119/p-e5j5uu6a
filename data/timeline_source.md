# 時代牌年表來源說明（timeline v1.1，補官方來源）

數據研究員，2026-10-17。對應檔案：`data/timeline.json`（物件：`events`、`system_rules`）。只在本機提交，未推送。

## 1. 方法

- 對象：民國 80–89 年（1991–2000）出生者，遊戲年齡 0–22 歲。
- 來源優先順序：行政院、內政部、教育部（含部史網）、國防部、勞動部、衛福部／疾管署、中央氣象署、總統府、全國法規資料庫、國發會檔案管理局、監察院等官方頁面。找不到官方頁面時才用新聞或學術典藏備援，並在 `sources[].source_type` 標 `news` / `academic`。
- 所有網址在 2026-10-17 實際開啟過（curl 或網頁擷取），能載入才列入。taipower.com.tw 新聞稿對 curl 回 403、但網頁擷取可開啟。dca.moi.gov.tw、lis.ly.gov.tw、stat.gov.tw 從工作機 curl 連不上，但用網頁擷取確認可開啟、內容相符。
- `events` 是可做成時代牌的事件；會改變遊戲規則的制度（升學、學費、兵役、基本工資）放在 `system_rules`。
- 文案守則：災害只寫一般人的生活細節（停電、停課、淹水、量體溫），不以罹難者為焦點；官方死亡數字只放在 `notes`。政治事件只寫家庭與校園場景，不評價政黨或人物。

## 2. 年齡與學制的計算假設

- `age_at_event` = 事件年份 − 出生年份（遊戲用的整數年齡；生日還沒到的人實際少一歲）。
- 入學：**1–8 月出生者滿 6 歲那年 9 月入小一；9–12 月出生者晚一年，7 歲入學**（9/1 為入學基準日）。遊戲只抽出生年、不抽月份，所以 `school_stage` 用 1–8 月出生者（約占全年 2/3），9–12 月出生者如果不同，另列在 `school_stage_if_born_sep_dec`。
- 學年度以 8/1 為界。年級：1–6 國小、7–9 國中、10–12 高中職、13–16 大專（若升學）、之後為「大專畢業後」。不考慮留級、跳級、五專。
- `reachable_birth_years`：事件開始時年齡 ≤ 22，且事件結束時已出生的出生年。`age_min`／`age_max` 是這些出生年在事件開始時的年齡（下限 0、上限 22）。
- `counties` 用遊戲縣市 id（`taipei`、`new_taipei`、`taichung`、`taitung`、`penghu`），全國性事件寫 `["全國"]`；`county_impact.heavy/light` 標輕重；真實受災區另寫在 `impact_scope.regions`。高雄氣爆、高雄捷運等不在遊戲五縣市的事件，`counties` 是空陣列。
- 學制例子：九二一（88-09）時 80 年次 1–8 月出生者是國小 3 年級；COVID 三級警戒（110-05）只有 88–89 年次 ≤22 歲。

## 3. 事件（events）

分類統計：disaster 6、economy 6、education_system 1、epidemic 3、politics_policy 11、tech_culture 4，共 31 則。

| 民國年月 | 事件 | 分類 | 可觸發出生年 | 縣市（重／輕） | 來源 |
|---|---|---|---|---|---|
| 83-04 | 四一〇教育改造大遊行 | education_system | 80–83 | 全國 | [立法院（教育部書面報告）](https://lis.ly.gov.tw/lydbmeetr/uploadn/113/1130417/501.pdf)；[華視新聞（news）](https://news.cts.com.tw/cts/general/199404/199404101732521.html) |
| 84-03 | 全民健康保險開辦 | politics_policy | 80–84 | 全國 | [衛生福利部](https://www.mohw.gov.tw/cp-7-7-1.html)；[法務部全國法規資料庫](https://law.moj.gov.tw/LawClass/LawHistory.aspx?pcode=L0060001) |
| 85-03 | 首次總統直選 | politics_policy | 80–85 | 全國 | [國家發展委員會檔案管理局](https://art.archives.gov.tw/tw/art/1589.html)；[中央選舉委員會](https://bulletin.cec.gov.tw/?dir=01%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1%2F01%E7%B8%BD%E7%B5%B1%E5%89%AF%E7%B8%BD%E7%B5%B1) |
| 85-03 | 台北捷運木柵線通車 | tech_culture | 80–85 | taipei（重：taipei；輕：new_taipei） | [臺北市政府捷運工程局](https://ebook.dorts.gov.taipei/JRTST/ebook/no48/files/basic-html/page170.html) |
| 87-12～88-07 | 精省（臺灣省政府功能業務與組織調整） | politics_policy | 80–88 | 全國 | [法務部全國法規資料庫](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0040012)；[總統府](https://www.president.gov.tw/Page/294/33762)；[法務部全國法規資料庫](https://law.moj.gov.tw/LawClass/LawHistory.aspx?pcode=A0040012) |
| 88-09 | 九二一集集大地震 | disaster | 80–88 | 全國（重：taichung；輕：taipei,new_taipei,taitung,penghu） | [中央氣象署地震測報中心](https://scweb.cwa.gov.tw/special/19990921/1999092101471273043.htm)；[中央氣象署地震測報中心](https://scweb.cwa.gov.tw/zh-tw/page/disaster/3)；[教育部部史網站](https://history.moe.gov.tw/Memorabilia?yearInterval=1992%EF%BC%8D2001&page=5)；[台灣電力公司](https://www.taipower.com.tw/2289/2323/2324/7378/normalPost)；[台灣電力公司](https://service.taipower.com.tw/tpcjournal/article/3441)；[總統府](https://www.president.gov.tw/NEWS/6042)；[中央研究院 921 地震知識庫（Internet Archive 存檔）（academic）](https://web.archive.org/web/20160304185624/http:/921kb.sinica.edu.tw/archive/wcamoea/wcamoea3.html) |
| 89-03 | 第一次政黨輪替 | politics_policy | 80–89 | 全國 | [總統府](https://www.president.gov.tw/Page/87)；[中央選舉委員會](https://bulletin.cec.gov.tw/?dir=01%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1%2F01%E7%B8%BD%E7%B5%B1%E5%89%AF%E7%B8%BD%E7%B5%B1) |
| 90-01 | 週休二日全面實施 | politics_policy | 80–89 | 全國 | [考試院主管法規共用系統](https://law.exam.gov.tw/LawContent.aspx?id=GL000386)；[法務部全國法規資料庫](https://law.moj.gov.tw/LawClass/LawHistory.aspx?pcode=N0030001)；[教育部部史網站](https://history.moe.gov.tw/Memorabilia?yearInterval=1992%EF%BC%8D2001&page=4) |
| 90-09～90-09 | 納莉颱風 | disaster | 80–89 | taipei,new_taipei（重：taipei,new_taipei；輕：taichung） | [中央氣象署](https://rdc28.cwa.gov.tw/TDB/public/typhoon_detail?typhoon_id=200116)；[行政院人事行政總處](https://www.dgpa.gov.tw/information?uid=374&pid=7002)；[行政院人事行政總處](https://www.dgpa.gov.tw/information?uid=374&pid=7001)；[行政院人事行政總處](https://www.dgpa.gov.tw/information?uid=374&pid=7000)；[臺北市政府人事處](https://dop.gov.taipei/cp.aspx?n=EFE42F770DFD63FB)；[農業部農村發展及水土保持署](https://photo.ardswc.gov.tw/PhotoStory/Home/Story?StoryID=e6bfae5d-3a16-41e5-95bd-58fa4e032928) |
| 92-03～92-07 | SARS 疫情 | epidemic | 80–89 | 全國（重：taipei；輕：new_taipei,taichung,taitung,penghu） | [衛生福利部疾病管制署](https://www.cdc.gov.tw/Category/ListContent/AHwuigegBBBmuDcbWkzoGQ?uaid=aGNhTomCVt4pYDa2rJOn_w)；[衛生福利部疾病管制署](https://www.cdc.gov.tw/Category/Page/Kou_i6ATU8jUnmKlAORhUA)；[World Health Organization](https://www.who.int/emergencies/disease-outbreak-news/item/2003_07_05-en)；[監察院國家人權委員會](https://nhrc.cy.gov.tw/News_Content.aspx?n=7459&s=6995&sms=12385)；[教育部部史網站](https://history.moe.gov.tw/Memorabilia?yearInterval=2002%EF%BC%8D2011&page=2) |
| 96-01 | 台灣高鐵通車 | tech_culture | 80–89 | taipei,new_taipei,taichung（重：—；輕：taipei,new_taipei,taichung） | [交通部鐵道局](https://www.rb.gov.tw/zh-TW/main/main_28/20250505_152320/20251104_134001/20250505_180533/)；[行政院](https://www.ey.gov.tw/state/A44E5E33CDA7E738/5930b373-fd7d-4d8f-87e8-7f6ff15c67a7) |
| 96-07 | 基本工資十年來首次調整 | economy | 80–89 | 全國 | [勞動部](https://www.mol.gov.tw/1607/28162/28166/28180/28182/28184/29016/) |
| 97-03 | 高雄捷運通車 | tech_culture | 80–89 | — | [高雄市政府](https://orgws.kcg.gov.tw/001/KcgOrgUploadFiles/408/relfile/0/77478/e97b45b5-1838-4aba-8c13-219b752e190e.pdf)；[高雄市政府交通局](https://www.tbkc.gov.tw/Service/PublicTransport/MRT?id=8400efe0-67dc-4ca2-86b7-0a0d9590bd08) |
| 97-03 | 第二次政黨輪替 | politics_policy | 80–89 | 全國 | [總統府](https://www.president.gov.tw/Page/88)；[中央選舉委員會（新竹縣選舉委員會）](https://web.cec.gov.tw/hcec/article/2607)；[中央選舉委員會（臺北市選舉委員會）](https://web.cec.gov.tw/tpcec/article/10906) |
| 97-09～98-12 | 金融海嘯與無薪假 | economy | 80–89 | 全國 | [中央銀行](https://www.cbc.gov.tw/tw/public/Attachment/0691765171.pdf)；[中央銀行](https://www.cbc.gov.tw/tw/public/Attachment/161418132671.pdf)；[國家發展委員會](https://ws.ndc.gov.tw/Download.ashx?icon=..pdf&n=OTnlubTmqqLoqI7nsKHloLEucGRm&u=LzAwMS9hZG1pbmlzdHJhdG9yLzEwL3JlbGZpbGUvMC84NjUwLzBhYjFlM2IyLTQzMTEtNDk2NC05ZGZhLTk4MWVjODc2ODM4NC5wZGY%3D)；[行政院](https://www.ey.gov.tw/Page/9277F759E41CCD91/82757c51-eda8-4b8f-bc68-e8080799275b)；[行政院](https://www.ey.gov.tw/Page/9277F759E41CCD91/b06c3b64-3b4b-44de-8e02-ab96227456e0)；[勞動部（前勞委會職訓局）](https://www.mol.gov.tw/media/xitprwza/%E5%9C%8B%E9%9A%9B%E7%9E%AD%E6%9C%9B%E5%8F%B0-03.pdf?mediaDL=true)；[勞動部](https://www.mol.gov.tw/1607/28162/28166/28218/28228/30525/post)；[中央社（news）](https://www.cna.com.tw/news/firstnews/202005180148.aspx)；[大紀元（news）](https://www.epochtimes.com/gb/9/3/3/n2449456.htm)；[新唐人（news）](https://www.ntdtv.com/gb/2009/03/03/a264329.html) |
| 98-01～98-09 | 振興經濟消費券 | economy | 80–89 | 全國 | [法務部全國法規資料庫](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030232)；[法務部全國法規資料庫](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=D0010066)；[行政院](https://www.ey.gov.tw/Page/9277F759E41CCD91/6534b964-0ca2-4678-9fdd-22f055b0498c) |
| 98-04～99-09 | 大專畢業生至企業職場實習方案（22K） | economy | 80–89 | 全國 | [教育部主管法規共用系統](https://edu.law.moe.gov.tw/LawContent.aspx?id=FL048988) |
| 98-08～98-08 | 莫拉克颱風（八八風災） | disaster | 80–89 | taitung（重：taitung；輕：taichung,penghu） | [中央氣象署](https://rdc28.cwa.gov.tw/TDB/public/typhoon_detail?typhoon_id=200908)；[行政院](https://www.ey.gov.tw/Page/9277F759E41CCD91/623aaa0e-4aa9-42ba-83dd-5b888850a564)；[新唐人（轉載中央社）（news）](https://www.ntdtv.com/gb/2009/08/20/a335246.html)；[天眼日報（news）](https://tynews.com.tw/index/News/Show/id/13105)；[國立科學工藝博物館（典藏行政院重建會網站）](https://exhibition.nstm.gov.tw/morakot/webhistory/88flood/index-2.html) |
| 103-03～103-04 | 太陽花學運 | politics_policy | 81–89 | 全國（重：taipei；輕：—） | [行政院](https://www.ey.gov.tw/Page/9277F759E41CCD91/1abea200-32b5-4613-a10d-57209cce5fbc)；[行政院](https://www.ey.gov.tw/Page/9277F759E41CCD91/0ff9e6e4-677d-422f-9ad2-0639acc41f62)；[行政院](https://www.ey.gov.tw/Page/9277F759E41CCD91/7f0f01a3-9ad4-4f7d-89d9-e19ee244f294)；[Executive Yuan](https://english.ey.gov.tw/Page/61BF20C3E89B856/ee280931-afdf-497b-923b-0f26154db5ce)；[中央研究院 歷史語言研究所、資訊科學研究所（academic）](https://ascdc.digitalarchives.tw/site_6988.html)；[中央社（news）](https://www.cna.com.tw/news/aipl/202403165004.aspx) |
| 103-05 | 4G 行動寬頻服務開通 | tech_culture | 81–89 | 全國 | [國家通訊傳播委員會](https://www.ey.gov.tw/File/A41BC6923F9DC927?A=C) |
| 103-07～103-08 | 高雄氣爆 | disaster | 81–89 | — | [行政院](https://www.ey.gov.tw/Page/9277F759E41CCD91/32418ab2-976e-44b0-8ac0-6644293fe1ad)；[監察院](https://www-ws.cy.gov.tw/Download.ashx?icon=.pdf&n=6auY6ZuE5rCj54iG5qGILnBkZg%3D%3D&u=LzAwMS9VcGxvYWQvQ3lPbGRGaWxlL3B1YmxpYy9kYXRhLzg4MzAxNjMxMjA3MS5wZGY%3D) |
| 104-06 | 八仙樂園粉塵暴燃 | disaster | 82–89 | new_taipei（重：new_taipei；輕：taipei） | [衛生福利部](https://topics.mohw.gov.tw/0627ACCIDENT/cp-2749-58982-202.html)；[衛生福利部](https://www.mohw.gov.tw/cp-2646-20478-1.html) |
| 105-01 | 第三次政黨輪替 | politics_policy | 83–89 | 全國 | [總統府](https://www.president.gov.tw/Page/705)；[中央社（news）](https://www.cna.com.tw/news/firstnews/201601165047.aspx) |
| 105-02 | 美濃地震 | disaster | 83–89 | taichung,taitung（重：—；輕：taichung,taitung） | [中央氣象署地震測報中心](https://scweb.cwa.gov.tw/zh-tw/earthquake/details/2016020603572666006)；[高雄市政府](https://orgws.kcg.gov.tw/001/KcgOrgUploadFiles/408/relfile/74090/215157/f4c993e9-1f53-4ba1-9f89-43d873c809ab.pdf) |
| 105-12～107-03 | 一例一休 | politics_policy | 83–89 | 全國 | [法務部全國法規資料庫](https://law.moj.gov.tw/LawClass/LawHistory.aspx?pcode=N0030001)；[勞動部](https://www.mol.gov.tw/media/g1ql3np0/%E5%8B%9E%E5%9F%BA%E6%B3%95%E6%96%B0%E6%B3%95%E4%B8%8A%E8%B7%AF%E8%A3%BD%E9%80%A0%E6%A5%AD%E5%9B%A0%E6%87%89%E9%A0%88%E7%9F%A5.pdf?mediaDL=true) |
| 107-07 | 軍公教年金改革施行 | politics_policy | 85–89 | 全國 | [行政院](https://www.ey.gov.tw/Page/5A8A0CB5B41DA11E/e021cef3-b983-449b-add8-0ea0eb18f4e6)；[法務部全國法規資料庫](https://law.moj.gov.tw/LawClass/LawSingle.aspx?flno=95&pcode=S0080034) |
| 108-05 | 同性婚姻專法施行 | politics_policy | 86–89 | 全國 | [法務部全國法規資料庫](https://law.moj.gov.tw/LawClass/LawHistory.aspx?pcode=B0000008)；[司法院](https://www.judicial.gov.tw/tw/cp-1429-57760-61de7-1.html) |
| 109-01～109-02 | COVID-19 首例與延後開學 | epidemic | 87–89 | 全國 | [衛生福利部疾病管制署](https://www.cdc.gov.tw/Bulletin/Detail/6oHuoqzW9e_onW0AaMEemg?typeid=9)；[行政院](https://www.ey.gov.tw/File/CF751B9FBDFDCEA7?A=C)；[衛生福利部（資料來源：疾病管制署）](https://www.mohw.gov.tw/cp-16-51286-1.html)；[衛生福利部食品藥物管理署](https://www.mohw.gov.tw/cp-4635-51376-1.html)；[衛生福利部中央健康保險署](https://mohw.gov.tw/cp-4635-51480-1.html)；[衛生福利部](https://covid19.mohw.gov.tw/ch/cp-4822-53563-205.html) |
| 109-07～109-12 | 振興三倍券 | economy | 87–89 | 全國 | [經濟部主管法規共用系統](https://law.moea.gov.tw/LawContent.aspx?id=GL001019) |
| 110-05～110-07 | COVID-19 三級警戒與全國停課 | epidemic | 88–89 | 全國（重：taipei,new_taipei；輕：taichung,taitung,penghu） | [衛生福利部疾病管制署](https://www.cdc.gov.tw/Bulletin/Detail/E7bi2j8UYj1Rmz73OPE7Yg?typeid=9)；[衛生福利部疾病管制署](https://www.cdc.gov.tw/Bulletin/Detail/aiGegg4ncYmMP9dTx4W_Zw?typeid=9)；[教育部](https://depart.moe.edu.tw/ed2100/News_Content.aspx?n=1BC1E5C3DD8E7C26&s=8BF1696CC31F4FE9&sms=5EDCB810B9A5DA84) |
| 110-10～111-04 | 振興五倍券 | economy | 88–89 | 全國 | [經濟部主管法規共用系統](https://law.moea.gov.tw/LawContent.aspx?id=GL001220) |

## 4. 制度規則（system_rules）

| id | 規則 | 生效 | 適用出生年 | 來源 |
|---|---|---|---|---|
| nine_year_integrated_curriculum | 國民中小學九年一貫課程 | 2001-08-01 | 80–89 | [教育部部史網站](https://history.moe.gov.tw/Memorabilia?yearInterval=1992%EF%BC%8D2001&page=6) |
| textbook_liberalization_one_guideline_many_versions | 一綱多本（教科書開放審定本） | 2001-08-01 | 80–89 | [教育部部史網站](https://history.moe.gov.tw/Memorabilia?yearInterval=1992%EF%BC%8D2001&page=5) |
| basic_competence_test_jice | 國中基本學力測驗（基測） | 2001-03-31 | 80–87 | [教育部部史網站](https://history.moe.gov.tw/Memorabilia?yearInterval=1992%EF%BC%8D2001&page=10)；[教育部部史網站](https://history.moe.gov.tw/Policy/Detail/bbc6f3c5-46f2-42dd-80dc-c3e037be8862)；[教育部部史網站](https://history.moe.gov.tw/Memorabilia?yearInterval=2002%EF%BC%8D2011&page=3)；[教育部部史網站](https://history.moe.gov.tw/Memorabilia?yearInterval=2012%EF%BC%8D2021&page=4)；[馬祖日報（連江縣政府）（news）](https://www.matsu-news.gov.tw/news/article/73609) |
| twelve_year_basic_education_cap | 十二年國民基本教育與國中教育會考 | 2014-05 | 88–89 | [教育部部史網站](https://history.moe.gov.tw/Memorabilia?yearInterval=2012%EF%BC%8D2021&page=4)；[教育部部史網站](https://history.moe.gov.tw/Policy/Detail/bbc6f3c5-46f2-42dd-80dc-c3e037be8862)；[教育部國民及學前教育署](https://www.k12ea.gov.tw/Tw/Station/AffairDetail?filter=63F293A9-0155-41A3-97B7-46E43E4685FE&id=793977bb-64ee-4211-9e8b-90bd52cc45db) |
| multiple_university_admission | 大學多元入學方案（取代大學聯考） | 2002-08-01 | 80–89 | [教育部部史網站](https://history.moe.gov.tw/Policy/Detail/bbc6f3c5-46f2-42dd-80dc-c3e037be8862)；[教育部部史網站](https://history.moe.gov.tw/Memorabilia?yearInterval=1992%EF%BC%8D2001&page=6)；[財團法人大學入學考試中心基金會](https://www.ceec.edu.tw/xmdoc/cont?xsmsid=0I363352685517160772) |
| vocational_admission_tvc | 技專校院多元入學與統一入學測驗（統測） | 2001-08-01 | 80–89 | [教育部部史網站](https://history.moe.gov.tw/Policy/Detail/bbc6f3c5-46f2-42dd-80dc-c3e037be8862)；[教育部部史網站](https://history.moe.gov.tw/Memorabilia?yearInterval=1992%EF%BC%8D2001&page=10)；[財團法人技專校院入學測驗中心基金會](https://www.tcte.edu.tw/index.php?mod=AboutCenter%2Fpage_intr)；[財團法人技專校院入學測驗中心基金會](https://web1.tcte.edu.tw/EXAM/090_4y/) |
| tuition_subsidy_114w_100_102 | 高職免學費／私立高中齊一學費（家戶年所得 114 萬元以下，100–102 學年） | 2011-08-01 | 82–87 | [臺北市政府](https://www-ws.gov.taipei/Download.ashx?n=NjgxODE3NDkzODcxLnBkZg%3D%3D&u=LzAwMS9VcGxvYWQvMzQyL3JlbGZpbGUvMzY5NjcvNzA3ODI1Mi82ODE4MTc0OTM4NzEucGRm)；[行政院主計總處](https://www.stat.gov.tw/News_Content.aspx?n=3908&s=210980) |
| tuition_free_148w_from_103 | 高中免學費（家戶年所得 148 萬元以下，103 學年起） | 2014-08-01 | 88–89 | [教育部](https://www.edu.tw/News_Content.aspx?n=9E7AC85F1954DDA8&s=42EE5BA1C2DE5D17)；[臺北市政府](https://www-ws.gov.taipei/Download.ashx?n=NjgxODE3NDkzODcxLnBkZg%3D%3D&u=LzAwMS9VcGxvYWQvMzQyL3JlbGZpbGUvMzY5NjcvNzA3ODI1Mi82ODE4MTc0OTM4NzEucGRm)；[行政院主計總處](https://www.stat.gov.tw/News_Content.aspx?n=3908&s=210980) |
| military_1yr_born_on_or_before_82 | 兵役：82 年次以前（1 年） | 2008-01-01 | 80–82 | [內政部役政署](https://dca.moi.gov.tw/chaspx/Faq_Detail.aspx?id=259&web=84)；[立法院](https://www.ly.gov.tw/EngPages/Detail.aspx?nodeid=4962&pid=23945)；[中央社（news）](https://www.cna.com.tw/news/aipl/202212270355.aspx) |
| military_4mo_training_83_93 | 兵役：83–93 年次（4 個月常備兵役軍事訓練） | 2013-01-01 | 83–89 | [內政部役政署](https://dca.moi.gov.tw/chaspx/Faq_Detail.aspx?id=259&web=84)；[國防部（行政院網站刊載）](https://www.ey.gov.tw/File/7D9C5766CA1F9541?A=C) |
| military_1yr_restored_94_plus | 兵役：94 年次以後（恢復 1 年） | 2024-01-01 | （不適用本遊戲） | [行政院](https://www.ey.gov.tw/Page/9277F759E41CCD91/d46f509b-0f03-4487-b218-ad6093bfa704)；[內政部役政署](https://dca.moi.gov.tw/chaspx/Faq_Detail.aspx?id=259&web=84) |
| alternative_service_launch | 替代役制度開始實施 | 2000-05-01 | 80–82 | [法務部全國法規資料庫](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=D0040017)；[法務部全國法規資料庫](https://law.moj.gov.tw/LawClass/LawHistory.aspx?pcode=D0040017)；[行政院](https://kids.ey.gov.tw/Page/3E5D19DCC4C902CC)；[中央社（news）](https://www.cna.com.tw/news/aipl/202212270355.aspx) |
| service_length_history | 義務役役期縮短沿革（背景） | 2004-01-01 | （不適用本遊戲） | [立法院](https://www.ly.gov.tw/EngPages/Detail.aspx?nodeid=4962&pid=23945)；[中央社（news）](https://www.cna.com.tw/news/aipl/202212270355.aspx) |
| basic_wage_schedule | 基本工資（月薪／時薪）歷年表 | 1997-10-16 | 80–89 | [勞動部](https://www.mol.gov.tw/1607/28162/28166/28180/28182/28184/29016/) |

### 4-1 兵役（依出生年，內政部役政署〈服役須知〉、國防部新聞稿、行政院 111-12-29）

| 出生年 | 本遊戲 | 常備役體位 | 替代役體位 |
|---|---|---|---|
| 82 年 12 月 31 日以前 | 80–82 | 1 年（97 年 1 月起役期 1 年；常備兵徵集到 106 年底，107-01-01 起尚未服役者改服 1 年替代役） | 1 年替代役 |
| 83-01-01 至 93-12-31 | 83–89 | 4 個月常備兵役軍事訓練（102 年起；專科以上可分兩個暑假） | 12 天補充兵役 |
| 94-01-01 以後 | 無 | 113-01-01 起恢復 1 年常備兵現役 | 1 年替代役 |

- 替代役：《替代役實施條例》89-02-02 公布、89-05-01 施行，89-08-03 第 1 梯次入營（全國法規資料庫沿革、行政院兒童網）。役期縮短沿革只是背景（父母那一代）。軍訓／全民國防課程可折抵役期（軍訓最多 30 日、全民國防教育最多 15 日）。女性不服義務役。

### 4-2 學費門檻（出處 data/v1.2_research.md 第 8-6 節，commit 29d27df）

- **高職免學費／私立高中齊一學費（家戶年所得 114 萬元以下，100–102 學年）**：100–102 學年度，家戶年所得 114 萬元以下的學生：高職（含五專前三年）免學費，私立高中學費比照公立（齊一學費）。 適用出生年：82,83,84,85,86,87。家戶涵蓋率（computed, rough）：約 56–62% 家戶（100 年家庭收支調查所得總額未滿 110 萬 56.1%、未滿 120 萬 61.6%；95 年 56.3–62.4%）。
- **高中免學費（家戶年所得 148 萬元以下，103 學年起）**：103 學年度起入學的學生逐年實施：就讀高職者免學費，就讀高中且家庭年所得 148 萬元以下者免學費，105 學年度三個年級全面施行。 適用出生年：88,89。家戶涵蓋率（computed, rough）：約 71–75% 家戶（100 年家庭收支調查所得總額未滿 140 萬 71.2%、未滿 150 萬 75.3%；95 年 72.1–76.2%）。
  - 114 萬是「在學期間」制（100-08-01 至 103-07-31 在高中職就算）；82 年次只有 9–12 月出生者在 100 學年還在高三。
  - 148 萬是「入學年」制（103 學年起入學才適用）：1–8 月出生的 88、89 年次，加上 9–12 月出生的 87 年次。86–87 年次 103 年後仍在學但 102 年以前入學，依附表二另計（⚠️待查）。

## 5. ⚠️待查

1. `taipei_mrt_muzha_line_opening`：⚠️待查：淡水線（1997）等後續路線通車日未逐條列入；如需「第一次搭捷運」卡，可依同一表補。
2. `jiji_earthquake_921`：⚠️待查：全國死亡失蹤官方總數（內政部消防署）未在本次來源中取得，需要時再補。
3. `two_day_weekend_2001`：學校先在 87 年 2 月 1 日起隔週休二日（教育部部史網）。《公務人員週休二日實施辦法》自 90-01-01 施行，第 5 條要求「各級學校應調整課程之教授」並可利用週休二日安排進修（✅官方：辦法 90-01-01 施行，條文明列各級學校配合）。學生端「全面週休二日」的起日：🟡 非官方來源（智邦公益電子報〈教育專題深入報導〉，2001 年，https://enews.url.com.tw/enews/6882 ）寫「各機關公務人員自 90 年 1 月 1 日起全面實施周休二日，各級學校亦自 2 月 1 日起全面實施」，跟原本的推定（89 學年度下學期、90 年 2 月開學起）一致。另外確認隔週休的法源：教育部〈各級學校每月二次週休二日處理原則〉第一點「各級學校自八十七年二月一日起實施每月二次週休二日」（92-01-14 停止適用，https://www.rootlaw.com.tw/LawArticle.aspx?LawID=A040080021015000-0920114 ，法規資料庫轉載）。⚠️待查：教育部 90-02-01 全面實施的原始函文（試過：教育部部史網 1992–2001、2001–2010 大事紀，教育部主管法規系統）。遊戲建議用「90 年 2 月（89 學年度下學期）起」。
4. `kaohsiung_mrt_opening`：橘線：高雄市府 PDF 寫 97-09-21 全線通車營運；高捷公司寫 9-14 通車、9-22 起收費（⚠️口徑不同）。
5. `global_financial_crisis_2008`：🟡 勞動部官員公開說法：勞動部勞動條件及就業平等司副司長黃維琛 2020-05-18 說「金融海嘯最嚴重的時期，發生在 98 年 2 月達 23 萬人」，98 年 11 月底 19,948 人（中央社 2020-05-18，https://www.cna.com.tw/news/firstnews/202005180148.aspx ，媒體引勞動部）。精確數字通報高峰 98-03-03 公布 586 家、238,975 人仍只有新聞轉述勞委會（大紀元、新唐人）；98 年 1 月中約 16 萬、2-16 約 20.3 萬。勞動部開放資料（data.gov.tw 40169）只從 100 年底起，查無 98 年原始半月報。
6. `typhoon_morakot`：（臺東）企劃已決定台東版只寫停水和斷路，不做延後開學（群組 2026-10-17），所以「臺東延後開學」不再需要查，這條關閉。停水：太麻里、知本淨水設備和配水管線損毀，臺灣自來水公司第十區搶修並呼籲煮沸後飲用（天眼日報，新聞，引台水 https://www.tynews.com.tw/index/News/Show/id/13315 ）；斷路：知本對外道路 8/7 中斷、8/14 倍力橋通車，南迴公路太麻里段 8/14 晚間路基坍陷再封閉（自由時報 2009-08-15，新聞 https://news.ltn.com.tw/news/life/paper/327297 ）。⚠️待查：停水戶數的官方數字（試過：水利署莫拉克新聞頁、行政院重建會典藏網站、監察院知本調查報告〔只談堤防〕）。原紀錄：臺東縣 42 校需整修、受災學生 179 人；嘉蘭國小、大武國中小、香蘭國小等於學期初正式開學（天眼日報，新聞），未見臺東縣全縣延後開學的官方公告，推定臺東多數學校如期開學。各縣市延後天數查無教育部逐縣表。
7. `sunflower_movement`：✅立法院公報：第 103 卷第 19 期（103-04-02 出版）收錄 103-03-17 內政等八委員會聯席會議審查「海峽兩岸服務貿易協議」案（即 3/18 占領前一天的那場會議），https://ppg.ly.gov.tw/ppg/publications/official-gazettes/103/19/01/details ；3/10–3/13 的聯席審查在第 103 卷第 18 期（103-03-31 出版）https://ppg.ly.gov.tw/ppg/publications/official-gazettes/103/18/01/details 。議場被占領期間（3/18–4/10）院會沒有開會，公報沒有占領本身的紀錄，占領起訖以行政院新聞稿為準。國家人權博物館、國家文化記憶庫的頁面仍未取得（不影響遊戲）。
8. `mobile_broadband_4g_launch`：⚠️待查：3G 開台（92 年／94 年）與智慧型手機普及率尚無 NCC 官方頁面，暫不列為事件。
9. `third_party_turnover_2016`：16 歲起已能感受選舉氣氛；20 歲以上（本遊戲 85 年次以前）才有投票權（當時投票年齡 20 歲）。⚠️待查：投票年齡依憲法第 130 條為 20 歲，未另附來源。
10. `meinong_earthquake`：⚠️待查：官方死亡人數（內政部消防署），需要時再補。
11. `triple_stimulus_voucher`：⚠️待查：「付 1,000 得 3,000」細節以發放辦法原文再確認。
12. `textbook_liberalization_one_guideline_many_versions`：⚠️待查：國小教科書逐年開放的起始學年（約 85 學年起）與各縣市「一綱一本」政策，未取得官方原文。
13. `vocational_admission_tvc`：⚠️待查：「統測」二字作為官方簡稱首次出現的年份，未找到明文（2026-10-17 第二輪再試：技專校院入學測驗中心簡介、教育部部史網大事紀，都只寫全名「四技二專統一入學測驗」；中心網站 107 學年度以前的報告回覆「檔案不存在」）。遊戲文案可以用「統測」，這是通用簡稱，不需要年份。
14. `tuition_subsidy_114w_100_102`：就學貸款「114 萬以下在學期間利息全額補貼」：⚠️待再確認原文。
15. `military_1yr_born_on_or_before_82`：✅已查（2026-10-17）：改服 1 年替代役自 107-01-01 起，不是 102 年；最後一批 1 年常備兵 107-12-26 退伍（[高雄市兵役處](https://mildp.kcg.gov.tw/News_Content.aspx?n=B704DE2C4F1BF038&s=65E3613F85D2D96D&sms=14201CF2CF29F79C)、[國防部 107-12-17 新聞稿](https://www.mnd.gov.tw/news/pressrelease/75839)）。人生故事研究員 M-11 指出。
16. `service_length_history`：⚠️待查：1 年 10 個月的起點，中央社寫 2000 年 1 月、立法院頁寫 93 年起由 1 年 10 個月縮為 1 年 8 個月，兩者不衝突但起點年份需國防部原文確認。
17. 3G 開台（92／94 年）與智慧型手機普及率：沒有找到 NCC 官方頁面，沒有列為事件（4G 有 NCC 院會簡報）。
18. 九二一、美濃地震的官方死亡總數（內政部消防署）沒有放進來；如需要放進 notes 再查。
19. 遊戲沒有出生月份，9–12 月出生者的學制錯一年；如果要精準，引擎需要抽出生月份或統一用 1–8 月假設。

## 6. 文案細節查證

狀態：✅ 官方頁面確認；🟡 官方確認一部分，其餘只有新聞或推定；⚠️ 待查。

| # | 項目 | 答案 | 來源 | 狀態 |
|---|---|---|---|---|
| a | 九二一停電範圍與時間 | 中寮超高壓開閉所震毀，南北電網解聯，中部以北全黑，全台 649 萬戶停電（台電稱史上最嚴重）；嘉民以南、花東照常供電。9/22 上午 7 時仍約 295 萬戶（28.7%）停電，9/24 民生用電大致恢復、災區約 9 萬戶待修；北部分區輪流限電到 88-10-09 晚提前解除。災區山區、倒塌建物較晚。 | [台電新聞稿 2019-09-20](https://www.taipower.com.tw/2289/2323/2324/7378/normalPost)、[台電月刊](https://service.taipower.com.tw/tpcjournal/article/3441)、[總統府 88-10-10](https://www.president.gov.tw/NEWS/6042)；逐日戶數取自[中研院 921 知識庫存檔的經濟部資料（academic）](https://web.archive.org/web/20160304185624/http:/921kb.sinica.edu.tw/archive/wcamoea/wcamoea3.html) | 🟡 649 萬戶與 10/9 解除限電 ✅；逐日戶數為典藏存檔 |
| b | 納莉颱風停班停課 | 9/17（一）、9/18（二）台北市、台北縣、台中市、台中縣都停止辦公上課；9/19（三）台北市、台中恢復，台北縣汐止、瑞芳、平溪、雙溪續停。臺東 9/17–19 照常；澎湖 9/19 停。 | [人事行政總處 90-09-17](https://www.dgpa.gov.tw/information?uid=374&pid=7002)、[90-09-18](https://www.dgpa.gov.tw/information?uid=374&pid=7001)、[90-09-19](https://www.dgpa.gov.tw/information?uid=374&pid=7000)、[臺北市人事處](https://dop.gov.taipei/cp.aspx?n=EFE42F770DFD63FB) | ✅ |
| c | 八八風災延後開學 | 98 學年度中小學 8/31 開學。行政院（98-08-14）：教育部預估全國 22 所受創嚴重國中小無法在 8/31 前開學，協助易地復學。教育部 8/20（新聞轉述）：18 校如期但易地開學（南投、高雄縣、屏東），嘉義縣阿里山鄉 8 校待評估。臺東：42 校需整修、受災學生 179 人，嘉蘭、大武國中小、香蘭等校學期初開學（新聞）；查無臺東全縣延後開學的公告，推定多數如期。 | [行政院 98-08-14](https://www.ey.gov.tw/Page/9277F759E41CCD91/623aaa0e-4aa9-42ba-83dd-5b888850a564)；[新唐人轉載中央社（news）](https://www.ntdtv.com/gb/2009/08/20/a335246.html)；[天眼日報（news）](https://tynews.com.tw/index/News/Show/id/13105) | 🟡 22 校 ✅；逐縣延後天數、臺東 ⚠️ |
| d | 學校全面週休二日 | 學校 87-02-01 起隔週休二日；《公務人員週休二日實施辦法》90-01-01 施行，第 5 條明列各級學校配合調整課程。學生端：非官方來源寫各級學校自 90-02-01 全面實施（89 學年度下學期）。 | [教育部部史網](https://history.moe.gov.tw/Memorabilia?yearInterval=1992%EF%BC%8D2001&page=4)、[考試院法規系統](https://law.exam.gov.tw/LawContent.aspx?id=GL000386)、[每月二次週休二日處理原則](https://www.rootlaw.com.tw/LawArticle.aspx?LawID=A040080021015000-0920114)；[智邦公益電子報（非官方）](https://enews.url.com.tw/enews/6882) | 🟡 辦法日期 ✅；學校 90-02-01 只有非官方來源 |
| e | 「統測」名稱 | 90 學年度（90 年 4 月）首屆「四技二專統一入學測驗」，由技專校院入學測驗中心辦理；「統測」是它的簡稱，從首屆就叫「統一入學測驗」。 | [技專校院入學測驗中心 簡介](https://www.tcte.edu.tw/index.php?mod=AboutCenter%2Fpage_intr)、[90 學年度試題頁](https://web1.tcte.edu.tw/EXAM/090_4y/) | 🟡 90 學年首辦 ✅；「統測」二字的官方啟用年 ⚠️ |
| f | COVID 口罩實名制與排隊 | 政府徵用口罩；2/4 起超商停售，2020-02-06 起「口罩實名制」上路：持本人健保卡到健保特約藥局（約 6,000 多家，偏鄉由衛生所）購買，每卡 7 天 2 片、10 元 2 片；身分證末碼單號一三五、雙號二四六、週日不限；兒童口罩限 12 歲以下；一人可代買一張卡。各藥局販售時段不同，民眾排隊購買；健保署開放庫存資料，民間做「口罩地圖」。 | [衛福部 109-02-03](https://www.mohw.gov.tw/cp-16-51286-1.html)、[食藥署 109-02-06](https://www.mohw.gov.tw/cp-4635-51376-1.html)、[健保署](https://mohw.gov.tw/cp-4635-51480-1.html)、[衛福部 口罩地圖](https://covid19.mohw.gov.tw/ch/cp-4822-53563-205.html) | ✅ |
| — | 金融海嘯無薪假高峰 | 官方：97 年 12 月 200 人以上企業 525 家、約 20.2 萬人實施無薪假，平均每月休 4 天。通報高峰 98-03-03 公布 586 家、238,975 人只有新聞轉述勞委會。98 年經濟成長率 −1.87%（後修正 −1.93%）、失業率 5.85%，8 月 6.13% 為高峰。 | [台灣勞工季刊 2009-03（勞動部）](https://www.mol.gov.tw/media/xitprwza/%E5%9C%8B%E9%9A%9B%E7%9E%AD%E6%9C%9B%E5%8F%B0-03.pdf?mediaDL=true)、[央行年報](https://www.cbc.gov.tw/tw/public/Attachment/0691765171.pdf)；[大紀元（news）](https://www.epochtimes.com/gb/9/3/3/n2449456.htm) | 🟡 高峰「98 年 2 月約 23 萬人」有勞動部副司長公開說法（[中央社 2020-05-18](https://www.cna.com.tw/news/firstnews/202005180148.aspx)）；238,975 的原始半月報 ⚠️ |
| — | 太陽花日期 | 103-03-18 學生佔據立法院議場，04-10 退出（行政院稱 24 天）。 | [行政院 103-04-07](https://www.ey.gov.tw/Page/9277F759E41CCD91/0ff9e6e4-677d-422f-9ad2-0639acc41f62)、[行政院 103-04-10](https://www.ey.gov.tw/Page/9277F759E41CCD91/1abea200-32b5-4613-a10d-57209cce5fbc) | ✅（立法院公報未核對） |
