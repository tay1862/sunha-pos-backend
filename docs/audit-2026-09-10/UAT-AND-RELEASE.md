# ชุดตรวจรับและคู่มือยืนยันความพร้อมก่อนใช้จริง

ฉบับ 11 กันยายน 2026 • ใช้คู่กับผลตรวจและแผน T01–T18

**สถานะปัจจุบัน:** ตาราง UAT ด้านล่างเป็นเกณฑ์ทดสอบที่ต้องทำหลังพัฒนา ไม่ใช่รายการที่ผ่านแล้ว ผลที่ผ่านจริงใน audit อยู่ใน README และ evidence logs เท่านั้น

## 1. ข้อมูลทดสอบมาตรฐาน

สร้าง fixtures แบบ repeatable ในฐานข้อมูลแยกและเก็บ expected results เป็นไฟล์:

| กลุ่ม      | ข้อมูล                                                                              |
| ---------- | ----------------------------------------------------------------------------------- |
| ร้าน       | Tenant A, Tenant B ชื่อคล้ายกันเพื่อจับ cross-tenant cache/query                    |
| ผู้ใช้     | Owner, Manager A/B, Cashier, พนักงาน inactive, พนักงาน PIN locked                   |
| เครื่อง    | A1 active lease valid, A2 active, A3 revoked; B1 คนละร้าน                           |
| สินค้า A   | ชิ้นละ 10,000 LAK, pack 6 ชิ้นราคา 55,000, track stock, ยอดเริ่ม 30 ชิ้น            |
| สินค้า B   | กาแฟ 20,000 + extra shot 5,000; ต้องเลือกความหวาน 1 ค่า                             |
| สินค้า C   | ชั่ง 0.001–10.000 หน่วย, conversion มีเศษ เพื่อทดสอบ rounding                       |
| สินค้า D   | item inactive และ unit inactive แยกกรณี                                             |
| ภาษี       | 0%, exclusive 10%, inclusive 10% เป็น fixture เท่านั้น ไม่ใช่อัตราภาษีแนะนำ         |
| กะ         | วันก่อนปิดแล้ว, วันนี้ยังไม่เปิด, วันนี้เปิดแล้ว, รายการคืนข้ามกะ                   |
| ข้อมูลใหญ่ | 5,000 items, 50,000 receipts, ชื่อซ้ำ/ชื่อยาว Lao/Thai/English                      |
| เครือข่าย  | ปกติ, ไม่มีเน็ต, API ตอบ 500, timeout ก่อนส่ง, response หายหลัง commit, latency สูง |

ทุก test บันทึก commit/app build/device/OS/backend/migration versions, role, fixture version, UTC+business time, expected/actual, log correlationId และผู้ทดสอบ ห้ามแนบ access token, refresh token, PIN จริง หรือข้อมูลลูกค้าจริง

## 2. Acceptance scenarios สำหรับธุรกิจ

| ID / งาน    | ขั้นตอนหลัก                                              | ผลที่ต้องได้                                                         |
| ----------- | -------------------------------------------------------- | -------------------------------------------------------------------- |
| A01 T04/T10 | เปิดแอปใหม่โดยไม่มี session และเปิด deep link `/items`   | เข้าสู่ login/onboarding; ไม่เรียก business API แบบไม่มี context     |
| A02 T10     | สมัครร้าน ตั้งข้อมูล PIN manager และเครื่อง              | ไปหน้าขายได้เอง; ชื่อร้านจริงแสดงถูก; ไม่ใช้ SQL ตั้งค่าต่อ          |
| A03 T10     | email provider ล่มหลัง signup → ลองต่อ flow              | บัญชีเดียว, บอก pending verification, resend/resume ได้              |
| A04 T04     | login รอ access expiry แล้วเรียก API หลายคำขอพร้อมกัน    | refresh ครั้งเดียวและทำงานต่อ; ไม่มี replay token เก่า               |
| A05 T04     | PIN ผิดซ้ำ/locked/ถูกต้อง/สลับ cashier                   | session และ UI role ตรง; ผิด PIN ไม่เปลี่ยน actor                    |
| A06 T04     | ปลอม employee/device headers โดยใช้ session cashier      | ไม่เพิ่มสิทธิ์เป็น owner/manager; ทุก endpoint บังคับ actor binding  |
| A07 T04/T08 | ร้าน A มี cart/outbox → logout → login ร้าน B            | B ไม่เห็น/ส่งข้อมูล A; A pending ไม่ถูกลบทิ้ง                        |
| A08 T04     | enroll เครื่องใหม่/revoke/login เครื่องที่สอง            | ID เครื่องไม่ซ้ำแบบยืม owner device; revoked device ใช้ไม่ได้        |
| C01 T11     | สร้าง category → item หลายหน่วย → assign modifier        | แคตตาล็อกขายแสดงข้อมูลครบและแก้ไขกลับได้                             |
| C02 T03/T11 | ขาย 2 pack ของ A                                         | ตัด 12 base units; ราคา 110,000 ก่อน tax; receipt หน่วย pack         |
| C03 T11     | เลือกกาแฟไม่ครบ required แล้วเลือกครบ                    | ไม่ยอมเพิ่มรายการไม่ครบ; extra shot บวกตาม fixture                   |
| C04 T11     | กาแฟ item เดียวกันแต่ modifier/note ต่างกัน              | cart line แยกกัน; แก้หนึ่งบรรทัดไม่เปลี่ยนอีกบรรทัด                  |
| C05 T03     | ปิด item/unit หลังโหลด catalog แล้ว checkout             | ได้ error/requote ที่กู้คืนได้; ไม่ขาย inactive แบบเงียบ             |
| C06 T03     | quantity=0, multiplier=0, ราคาไม่ถูกต้อง, barcode ซ้ำ    | ปฏิเสธตาม field/contract; ไม่มี partial invalid data                 |
| P01 T03     | 10,000 + exclusive tax 10%, รับ 20,000                   | UI/API/receipt total 11,000, change 9,000                            |
| P02 T03     | 10,000 ลด fixed 1,000 + exclusive 10%, รับ 20,000        | subtotal 10,000, discount 1,000, tax 900, total 9,900, change 10,100 |
| P03 T03     | inclusive price 11,000 tax 10%, ไม่มีส่วนลด              | total 11,000 และ tax component 1,000 ตาม domain definition           |
| P04 T03     | จบบิลมีส่วนลด → เริ่มบิลใหม่                             | discount/payment fields เริ่มใหม่; บิลเก่ายัง snapshot เดิม          |
| P05 T03/T05 | เงินรับน้อยกว่ายอด/กด confirm ซ้ำ/ปิด modal ระหว่างส่ง   | ไม่มีสำเร็จลวงหรือบิลซ้ำ; pending outcome กู้คืนได้                  |
| P06 T05     | server commit แล้ว response หาย → retry/restart 10 ครั้ง | มี order/payment/receipt ชุดเดียวและ stock ลดครั้งเดียว              |
| P07 T05     | clientOrderId เดิม payload ต่าง                          | conflict ที่อธิบายได้; ไม่คืน success ของบิลคนละเนื้อหา              |
| P08 T03/T17 | 2 เครื่องขาย stock ชิ้นสุดท้ายพร้อมกัน                   | สำเร็จหนึ่งรายการ อีกอัน conflict; stock ไม่ติดลบ                    |
| P09 T03/T14 | manual QR/transfer/card                                  | แสดงสถานะตรวจด้วยคนตามนโยบาย; ไม่อ้าง bank confirmation              |
| S01 T02     | เปิด/ปิดกะ 10 รอบ                                        | ประวัติครบ 10 กะ; ไม่มี unique false/HTTP500                         |
| S02 T02     | open พร้อมกัน 2 เครื่อง                                  | ได้กะเปิดเพียงหนึ่งกะ; อีกรายการได้ business response                |
| S03 T02     | เริ่ม 100k, sale55k, in10k, out20k, refund11k            | expected 134k; actual 133k → variance −1k; audit ครบ                 |
| S04 T02     | CASH_OUT บวก/ลบ/CASH_IN ลบจาก API                        | reject หรือ normalize ตาม contract เดียว ไม่กลับทิศ ledger           |
| S05 T02/T07 | ปิดกะพร้อมขาย/เงินออก/local pending                      | transaction สอดคล้อง; ไม่ปิดข้ามธุรกรรมที่ยังไม่สรุป                 |
| S06 T02/T09 | คืนเงินบิลเมื่อวานในกะวันนี้                             | cash-out อยู่กะวันนี้; บิลเดิมไม่แก้ราคา; report วันคืนถูก           |
| R01 T09     | cashier ขอคืนพร้อม manager approval ที่ถูกต้อง           | คืนตาม permission ที่ออกแบบ; cashier ลำพังไม่ได้                     |
| R02 T09     | PIN ผิด/manager inactive/approval หมดอายุหรือ replay     | ปฏิเสธและ audit เหมาะสม; ไม่เปลี่ยน stock/payment                    |
| R03 T09     | refund order เดียวพร้อมกัน 2 คำขอ                        | refund/payment reversal/stock restoration ชุดเดียว                   |
| R04 T09     | คืนสินค้าที่ quantity×conversion มีเศษปัด                | base stock คืนเท่าที่ตัดจริง; balance ก่อนขายเท่าหลังคืน             |
| O01 T07/T08 | โหลด policy/catalog → ปิดเน็ต → restart → ขาย            | ใช้ policy ที่ persist และใบเสร็จ local ได้ภายในสิทธิ์               |
| O02 T05/T08 | disk full หรือ DB write fail ตอน confirm                 | ไม่แจ้งว่าบันทึกแล้ว; cart/operation กู้ได้ตามสถานะ                  |
| O03 T06     | retry due ผ่านไป 1 วินาทีในวันเดียวกัน                   | pending ถูกเลือกจริง; backoff เพิ่มตาม attempt ไม่คง 1s              |
| O04 T06     | push ACKED แล้ว pull ล้ม                                 | ACKED ไม่ย้อน PENDING; cursor ยังไม่ข้ามข้อมูลที่ไม่ apply           |
| O05 T06     | kill process ระหว่าง SYNCING แล้วเปิดใหม่                | claim กู้คืนได้และไม่ apply side effect ซ้ำ                          |
| O06 T06     | operations dependsOn แต่ timestamps เท่ากัน/สลับ         | ประมวลผลตาม dependency หรือ review ชัดเจน                            |
| O07 T07     | lease valid ตอนขาย หมดก่อน sync / clock skew             | รายการไม่หาย; ตัดสินด้วยนโยบายและหลักฐานที่กำหนด                     |
| O08 T07     | เพิ่มเครื่องที่สอง/revoke ระหว่าง offline                | รับเงินตามขอบเขตที่อนุญาต; discrepancy ต้องเห็นและจัดการได้          |
| O09 T07/T14 | ขาย offline ก่อนเที่ยงคืน sync วันรุ่งขึ้น               | businessDate/report/shift ไม่ย้ายยอดแบบเงียบ                         |
| O10 T08     | upgrade schema เก่ามี cart/queue; migration fail         | success รักษาข้อมูล; fail rollback และไม่ปลอม version                |
| H01 T12     | scan barcode pack/unknown/repeated frames                | เพิ่มถูกหน่วยหนึ่งครั้ง; unknown แนะนำ manual entry                  |
| H02 T12/T15 | ปฏิเสธกล้อง/permanent denied                             | ข้อความอ่านชัดและยังใช้ค้นหาขายได้                                   |
| H03 T13     | พิมพ์ Lao/ชื่อยาว/modifier/discount/tax ที่ 58/80mm      | ไม่ตัด glyph/ยอด/ขอบกระดาษ; snapshot ตรง UI/server                   |
| H04 T13     | printer offline/กระดาษหมด/BT หลุด/LAN timeout            | sale ไม่หาย; print job failed/retry; ไม่ checkout ใหม่               |
| H05 T13     | restart แล้ว reprint สำเนา                               | บิลเดิม, COPY ตามนโยบาย, printer default ถูกตัว                      |
| D01 T14     | sales/payments/refunds by date/employee/device           | รวมตามนิยาม metric ได้ตรง ledger; gross/net ไม่สับสน                 |
| D02 T14     | เปิดประวัติ >100 ใบ/search เก่า/CSV export               | pagination ครบ; CSV flat/escape/safe money; totals ตรง               |
| D03 T14/T15 | API 403/500/offline/ไม่มีข้อมูล                          | แยก states; ไม่มี spinner ค้างหรือแสดงยอด 0 แทน error                |
| I01 T16     | Admin role read-only/manage/MFA ผิด/ถูก                  | permission ถูกและ audit ระบุคน; token ตัวที่สองคงที่ไม่นับ MFA จริง  |
| I02 T16     | suspend/unsuspend test tenant และตรวจ business API       | ผลสอดคล้อง, มี reason/actor/time; tenant อื่นไม่กระทบ                |
| X01 T17     | tenant B IDs ใน catalog/order/refund/sync/device/report  | ทุกจุดปฏิเสธ/ไม่เปิดเผยข้อมูลร้านอื่น                                |
| X02 T18     | restore backup ลง DB ใหม่                                | ยอด order/payment/refund/stock และ migration versions ตรง            |
| X03 T18     | upgrade app/API ที่มี offline queue รุ่นเก่า             | sync ได้ตาม compatibility contract; rollback ไม่ทิ้ง queue           |

## 3. Screen QA ที่ต้องทำทุกหน้า

กำหนดรุ่นอุปกรณ์จริงก่อนเริ่ม: Android phone ขนาดเล็ก, phone ขนาดปกติ, tablet แนวนอน และ tablet แนวตั้ง บันทึก resolution/density/font scaling/OS ที่ใช้ ไม่มี screenshot จาก browser ใดถือแทน native keyboard/safe-area/printer test

สำหรับ POS ทั้ง 17 routes และ Admin 1 route ให้ทำตารางย่อยต่อหน้า:

| สิ่งที่ตรวจ              | เกณฑ์ผ่าน                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| Navigation               | เข้าได้จากเมนูตาม role; back/cancel/system-back ถูก; deep link มี session guard             |
| Initial/loading          | ไม่แสดง empty แทนกำลังโหลด; timeout มีทางออก                                                |
| Empty/data-rich          | มีคำแนะนำ action; ข้อมูลยาว/จำนวนมาก scroll ได้                                             |
| Error/offline/permission | แยกข้อความและ recovery; ไม่มี no-op button                                                  |
| Save/delete/disable      | validation ใกล้ field; ป้องกัน double-submit; ยืนยันผลและเห็นข้อมูลใหม่                     |
| Light/dark               | สี/ข้อความ/ไอคอนครบทุก component; ไม่มีหน้าขาวสลับเมื่อ theme ควร dark                      |
| Language                 | Lao glyph ไม่ขาด; label/วันที่/จำนวน/เงินสอดคล้อง; ไม่ใช้ raw enum/error ที่ผู้ใช้ไม่เข้าใจ |
| Keyboard/safe area       | กรอก field ล่างได้; CTA ไม่บัง; scroll และ focus ถูก                                        |
| Accessibility            | ปุ่มมี role/name/state; font scaling แล้วยังทำงาน; TalkBack ลำดับอ่านถูก                    |
| Touch/layout             | hit area ตาม spec; PIN grid 3×4; ระยะห่างป้องกันกดลบแทนแก้                                  |
| Persistence              | กลับหน้าก่อน/หมุนจอ/restart ไม่ทำ draft/operation หายตามนโยบาย                              |
| Visual evidence          | รูปชื่อ `<route>-<device>-<theme>-<state>-<build>` พร้อมคำอธิบายข้อจำกัด                    |

Task usability กับแคชเชียร์ที่ไม่รู้ระบบ: ให้ตั้งร้าน/เพิ่มสินค้า/ขายแพ็กพร้อม modifier/คืนเงิน/ปิดกะโดยใช้โจทย์ ไม่ชี้นำ บันทึกเวลาจบ ความผิดพลาด จุดที่ถาม และความเข้าใจสถานะ offline/QR ให้แก้ blocker ก่อนทดสอบรอบถัดไป ไม่ใช้คำว่า “สวย” เพียงอย่างเดียวเป็นเกณฑ์ผ่าน

## 4. วิธีทำซ้ำหลักฐาน audit

ก่อนรันให้ใช้ checkout ของ release candidate และฐานข้อมูล disposable แยกเท่านั้น คำสั่งตัวอย่างต่อไปนี้สร้างข้อมูลสมมติ ไม่ชี้ไป production ใช้ PostgreSQL local role ของเครื่องที่มีสิทธิ์สร้าง DB ตั้งชื่อ DB ใหม่ทุกครั้งและปรับ username ให้ตรงเครื่อง ห้ามใช้ migration reset กับข้อมูลร้าน

```bash
pnpm exec turbo test typecheck lint --force
pnpm exec turbo build --force
createdb sunha_audit_repro
DATABASE_URL=postgresql://LOCAL_TEST_ROLE@localhost:5432/sunha_audit_repro pnpm --filter @sunha/api exec prisma migrate deploy
DATABASE_URL=postgresql://LOCAL_TEST_ROLE@localhost:5432/sunha_audit_repro RUN_INTEGRATION=true pnpm --filter @sunha/api exec vitest run src/orders/checkout.concurrent.int.spec.ts
```

ตรวจ `DATABASE_URL` ก่อนเริ่ม API; รันใน terminal แยกและปิด email/telemetry สำหรับ fixture run:

```bash
DATABASE_URL=postgresql://LOCAL_TEST_ROLE@localhost:5432/sunha_audit_repro NODE_ENV=development RESEND_API_KEY= EMAIL_FROM= SENTRY_DSN= PORT=3002 HOST=127.0.0.1 pnpm --filter @sunha/api start
```

จาก root อีก terminal:

```bash
SUNHA_AUDIT_DISPOSABLE=yes python3 docs/audit-2026-09-10/probe-local.py
```

`probe-local.py` เป็น diagnostic reproduction ไม่ใช่ regression suite ที่ assert ทุกข้อ และไม่ล้าง DB ให้อัตโนมัติ หลังแก้แล้วให้เปลี่ยนกรณี F01/F04/F05/F07 เป็น automated tests ที่ assert expected ที่ถูกต้อง แทนการยอมรับผลผิดเดิม จัดเก็บ/ลบเฉพาะ DB ทดสอบตามนโยบายทีม

ผล integration เดิม 5 ข้อไม่ได้ทดสอบ HTTP guard ทั้งหมด เพราะเรียก services โดยตรง Probe HTTP เติมหลักฐานบางจุด แต่ยังไม่แทน end-to-end app+API+hardware

## 5. Release gates และ stop conditions

| Gate             | ต้องมีหลักฐาน                                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| G1 เงิน/stock    | pricing fixtures, repeated shifts, concurrency, refunds, no-duplicate checkout ผ่าน; F01–F10 ที่เกี่ยวกับเงินปิดแล้ว |
| G2 identity/data | actor binding, tenant isolation, PIN/session/device, local migrations/encryption และ account recovery ผ่าน           |
| G3 ทุกหน้า       | screen matrix 18 หน้าครบตาม scope; ไม่มี placeholder/no-op/บันทึกไม่ได้; UX states ครบ                               |
| G4 hardware      | signed Android build, camera/BT/LAN/58–80mm/Lao receipts บนเครื่องที่ระบุผ่าน                                        |
| G5 operations    | HTTPS, migrate compatibility, restore drill, alerts, runbook และ owner support                                       |
| G6 pilot         | 7 วัน, หลายกะ, กระทบยอดทุกวันและ incidents ที่ยังค้างเป็นศูนย์ตามขอบเขต release                                      |

หยุด rollout/หยุดใช้ flow ที่กระทบเมื่อพบ: duplicate/lost sale, cash/stock difference อธิบายไม่ได้, ผิด tenant/actor, sync backlog เกิน SLA ที่ตกลง, คืนเงินซ้ำ, schema upgrade ทำ local data หาย หรือปิดกะไม่ได้ ห้ามให้ cashier แก้ด้วยการกด checkout ใหม่หรือ reinstall app ที่มี pending queue

## 6. Runbook ขัดข้องที่ทีมต้องเตรียม

**ลูกค้าชำระแล้วแต่แอปไม่ยืนยัน:** หา persistent operation/clientOrderId → ตรวจ local/server status → reconcile โดย ID เดิม → ให้ผล confirmed/pending/review พร้อมเอกสาร ไม่สร้างการขายใหม่จนรู้ผลเดิม

**sync ค้าง:** ตรวจ local queue/last ack/lease/session/connectivity → แยก transient กับ business conflict → retry เฉพาะ transient → manager resolve conflict แบบมี audit เก็บยอดรายการไว้; ห้าม clear cache/reset DB

**printer ล้ม:** ยืนยัน sale status แยก → เปลี่ยน/เชื่อม printer → retry print job → แสดง copy ตามนโยบาย; การพิมพ์สำเร็จไม่ใช่หลักฐานว่าเงินเข้า bank แล้ว

**ปิดกะยอดไม่ตรง:** freeze closing snapshot → ตรวจ cash movements/refunds/payment type/pending devices → ระบุ discrepancy + ผู้อนุมัติ → correction ledger; ห้ามแก้ original receipt หรือ stock ตรงใน DB

**deploy ล้ม:** ใช้ app/API version เดิมที่ compatible; ถ้า migration เป็น additive ให้ rollback code ก่อน; ถ้าต้อง restore ให้กำหนดช่วงข้อมูลที่เสี่ยงและ reconcile การขายหลัง backup โดยผู้รับผิดชอบ ห้าม restore ทับแล้วปล่อยข้อมูลขายใหม่หาย

## 7. แบบบันทึกตรวจรับต่อ test

```text
Test ID / Ticket:
Commit / app build / API image:
Device / OS / theme / font scaling:
Tenant fixture / role / policy version:
Preconditions:
Steps:
Expected:
Actual:
Status: PASS / FAIL / BLOCKED / NOT RUN
Evidence: screenshot/video/log/correlationId (ไม่มี secrets)
Issue ID / severity / owner:
Tester / reviewer / timestamp:
```

นิยาม PASS ต้องทำครบ steps และ expected; BLOCKED/NOT RUN ไม่นับผ่าน สรุป test coverage ด้วยจำนวนที่ทดสอบจริงและข้อจำกัด ไม่ใช้เปอร์เซ็นต์จากจำนวนไฟล์ที่ build ได้
