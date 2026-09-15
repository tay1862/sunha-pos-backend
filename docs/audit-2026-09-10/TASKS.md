# Checklist ลงมือพัฒนา POS

เริ่ม 11 กันยายน 2026 — ใช้ร่วมกับ [ผลตรวจ F01–F19](README.md), [รายละเอียดงาน T01–T18](IMPLEMENTATION-PLAN.md) และ [UAT 56 กรณี](UAT-AND-RELEASE.md)

สถานะ: ☐ ยังไม่เริ่ม · ◐ กำลังทำ/เสร็จบางส่วน · ☑ ผ่านเกณฑ์ทั้งหมดของงานแล้ว

| สถานะ | งานในแผน                                                | ปัญหา/เกณฑ์ที่เชื่อม     | หลักฐานล่าสุด                                                                                  |
| ----- | ------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------- |
| ◐     | [T01 baseline](IMPLEMENTATION-PLAN.md)                  | F18                      | รายงานและ baseline logs มีแล้ว; working tree มีงานค้าง                                         |
| ◐     | [T02 กะ/ledger](IMPLEMENTATION-PLAN.md)                 | F01,F05; S01–S06         | Batch 02: `shiftId` binding และ S05/S06 tests ผ่าน; strict no-open-shift policy ยังเหลือ       |
| ◐     | [T03 pricing/active items](IMPLEMENTATION-PLAN.md)      | F02,F04; P01–P04,C05     | server quote/catalogVersion + golden fixtures เพิ่มแล้ว; native UAT และ strict quote enforcement ยังเหลือ |
| ◐     | [T04 sessions/PIN/device](IMPLEMENTATION-PLAN.md)       | F03,F11; A01,A04–A08     | employee session/PIN-device binding เพิ่มแล้ว; root-state และบังคับ session ทุก route ยังเหลือ       |
| ◐     | [T05 durable checkout](IMPLEMENTATION-PLAN.md)          | F06; P05–P07,O02         | local outbox draft + ACK/failed states, timeout, request hash conflict เพิ่มแล้ว; reconcile UI ยังเหลือ |
| ◐     | [T06 outbox](IMPLEMENTATION-PLAN.md)                    | F07,F08; O03–O06         | epoch retry/backoff+jitter, atomic claim lease และ single-flight sync เพิ่มแล้ว; native crash test ยังเหลือ |
| ◐     | [T07 offline/reconciliation](IMPLEMENTATION-PLAN.md)    | F08,F14,F16; O01,O07–O09 | reconcile endpoint/UI และ lease-at-sale handling เพิ่มแล้ว; full projection/close gate ยังเหลือ |
| ◐     | [T08 local isolation/migration](IMPLEMENTATION-PLAN.md) | F09; A07,O10             | numbered local migration, tenant/store/device scope และ SecureStore key hardening เพิ่มแล้ว; SQLCipher/native UAT ยังเหลือ |
| ◐     | [T09 refund approval](IMPLEMENTATION-PLAN.md)           | F10; R01–R04             | manager PIN/device approval, snapshot quantity rounding, idempotent concurrent refund เพิ่มแล้ว; challenge flow ยังเหลือ |
| ◐     | [T10 onboarding/settings](IMPLEMENTATION-PLAN.md)       | F11,F17; A02,A03         | settings form โหลด/บันทึกจริง, logout/relogin และ LAK readonly เพิ่มแล้ว; owner PIN/onboarding resume ยังเหลือ |
| ◐     | [T11 catalog UI](IMPLEMENTATION-PLAN.md)                | F12; C01–C04,C06         | category/stock/unit/tax/modifier controls และหลาย unit ในหน้า sale เพิ่มแล้ว; modifier assignment/required picker ยังเหลือ |
| ◐     | [T12 barcode/stock](IMPLEMENTATION-PLAN.md)             | F12,F15; H01,H02         | barcode scan/manual fallback/debounce และ stock adjustment form + audit/manager PIN เพิ่มแล้ว; cart add จาก scanner/native UAT ยังเหลือ |
| ◐     | [T13 receipt/printer](IMPLEMENTATION-PLAN.md)           | F13; H03–H05             | persisted print_jobs status/retry metadata, profile validation และ single auto printer เพิ่มแล้ว; native hardware suite ยังเหลือ |
| ◐     | [T14 reports/export](IMPLEMENTATION-PLAN.md)            | F14,F19; D01–D03         | half-open date range, CSV BOM/flat refund rows และ filter/export UI เพิ่มแล้ว; aggregation/pagination ยังเหลือ |
| ◐     | [T15 UX ทุกหน้า](IMPLEMENTATION-PLAN.md)                | F15,F16; Screen QA       | shared form/button touch target, back/error states และ no-op controls แก้แล้ว; full visual/TalkBack QA ยังเหลือ |
| ◐     | [T16 internal admin](IMPLEMENTATION-PLAN.md)            | F17; I01,I02             | role/actor server config, tenant detail, suspend+unsuspend และ audit before/after เพิ่มแล้ว; MFA ยังเป็น deployment secret แบบคงที่ ต้องเชื่อม IdP/จริงก่อน production |
| ◐     | [T17 regression/CI](IMPLEMENTATION-PLAN.md)             | F18,F19; X01             | CI PostgreSQL/migrate deploy/integration gate และ `test:integration` เพิ่มแล้ว; ยังต้องรันบน CI และเก็บ artifact จริง |
| ◐     | [T18 release/pilot](IMPLEMENTATION-PLAN.md)             | X02,X03; G1–G6           | release-candidate workflow, release verification script และ restore/offline pilot runbook เพิ่มแล้ว; ยังต้องทำ drill บน environment/อุปกรณ์จริง |

### T18 implementation evidence (2026-09-11)

- เพิ่ม `.github/workflows/release-candidate.yml` สำหรับ tag `v*.*.*`: install แบบ frozen, lint/typecheck/test/build, Prisma validation, API image build และอัปโหลด commit/migration/checksum manifest
- เพิ่ม `ops/release-verify.sh` แบบ fail-fast สำหรับตรวจ release candidate; ถ้ามี `DATABASE_URL` จะ deploy migration จริง หากไม่มีจะหยุดที่ verification และแจ้งชัดเจนว่า migration ต้องทำใน release environment
- เพิ่ม [RELEASE-RUNBOOK.md](RELEASE-RUNBOOK.md) ครอบคลุม X02 `pg_dump`/`pg_restore` บน disposable DB, เปรียบเทียบยอดและ migration, X03 offline queue upgrade/rollback และ pilot 7 วันตาม gates G1–G6
- Verification local: release verification ผ่านครบ lint/typecheck/test/build (unit 26 ผ่าน; integration 8 ยัง skip เมื่อไม่มี PostgreSQL), admin build และ Android export ผ่าน

**T18 limitation:** ยังไม่มี production/staging backup restore ที่มีเวลาจริง, signed Android artifact, hardware/TLS/alert evidence หรือ pilot 7 วัน จึงยังไม่ติ๊ก G1–G6 ว่าผ่าน ต้องทำโดย QA/OPS บน environment และอุปกรณ์ที่ระบุใน UAT

### T17 implementation evidence (2026-09-11)

- CI `verify` เพิ่ม PostgreSQL 16 service พร้อม health check, `DATABASE_URL`, `RUN_INTEGRATION=true` และ `prisma migrate deploy` ก่อนตรวจชุดทดสอบ ทำให้ checkout/shift/sync integration และ tenant-isolation regression ไม่ถูก skip ใน CI
- เพิ่ม API script `test:integration` สำหรับรันไฟล์ `*.int.spec.ts` โดยตรง; package อื่นยังคงใช้ unit tests ตามเดิมเพื่อไม่ทำให้ package ที่ไม่มี test ถูก pass เงียบโดยไม่ตั้งใจ
- Existing integration suite ครอบคลุม tenant A/B IDs, device/store scope, concurrent checkout, shift close และ sync payload conflict; CI จะ fail เมื่อ migration หรือ integration test fail
- Verification รอบ local: Prettier ตรวจไฟล์ workflow/package/admin ผ่าน, API lint/typecheck ผ่าน, admin regression 4/4 ผ่าน

**T17 limitation:** ยังไม่ได้รัน PostgreSQL integration ในเครื่องนี้เพราะขึ้นกับ service ภายนอก; ต้องรันผ่าน GitHub Actions job หรือ local PostgreSQL disposable และเก็บ artifact log จริงก่อนติ๊กงานเป็นผ่านเต็มรูปแบบ

### T16 implementation evidence (2026-09-11)

- Admin guard ยังตรวจ token และ MFA ด้วย constant-time comparison แต่ role/actor ถูกกำหนดจาก API environment (`INTERNAL_ADMIN_ROLE`, `INTERNAL_ADMIN_ACTOR`) จึงไม่สามารถปลอม role จาก browser header ได้; role `READ_ONLY` ถูกปฏิเสธเมื่อเรียก suspend/unsuspend
- เพิ่ม `GET /admin/stores/:tenantId` รวม store detail, devices, sync queue และ audit โดยทุก query มี `tenantId` scope; ไม่ส่งข้อมูลร้านอื่นปะปน
- เพิ่ม `PATCH /admin/stores/:tenantId/unsuspend` พร้อมบังคับ reason และบันทึก `ADMIN_UNSUSPEND_STORE`; suspend/unsuspend บันทึก actor, server time และ before/after ใน transaction เดียว
- Admin UI มีปุ่ม Unsuspend และข้อความสถานะที่สอดคล้องกับผล action; ไม่มีความสามารถแก้ receipt ย้อนหลัง
- Verification: `apps/api/src/admin/admin-auth.guard.spec.ts` และ `admin.service.spec.ts` รวม 4 tests ผ่าน; report regression 2 tests ผ่าน; API/Admin lint และ typecheck ผ่าน

**T16 limitation:** ค่า `x-admin-mfa` ยังเป็น deployment secret คงที่ตามโค้ดเดิม จึงยังไม่ใช่ MFA จริงหรือ operator account/SSO ต่อคนตามเกณฑ์เต็มของ I01; ก่อน production ต้องเชื่อม IdP/OIDC หรือ challenge แบบ TOTP/WebAuthn, session expiry/revoke และเพิ่ม integration test บน PostgreSQL สำหรับ tenant isolation และ business API suspend/unsuspend

## Batch 01: ความถูกต้องของกะและยอดขาย

- [x] B01.1 migration unique เฉพาะกะที่เปิด ไม่จำกัดประวัติกะปิด
- [x] B01.2 เปิด/ปิด/เงินเข้าออก serialize และ audit ใน transaction เดียว
- [x] B01.3 server ป้องกัน CASH_IN/CASH_OUT ผิดเครื่องหมาย
- [x] B01.4 ปฏิเสธ inactive item/unit ใน checkout
- [x] B01.5 POS ใช้ shared domain คำนวณยอดภาษี/ส่วนลด/เงินทอนและ reset discount
- [x] B01.6 regression tests และ migration บนฐานข้อมูลแยก

### T02 S05/S06 verification

- [x] S05 checkout/payment ที่เกิดในกะเปิดถูกผูก `shiftId` เดียวกัน และปิดกะถูกบล็อกเมื่อมี `PENDING` sync operation
- [x] S06 checkout/refund ล็อกแถว Store เดียวกับ shift transition เพื่อไม่ให้ธุรกรรมแทรกระหว่างปิดกะ; integration test 8/8 ผ่าน
- [ ] S06 strict policy ยังไม่เสร็จ: checkout ที่ไม่มี active shift ยังรองรับ legacy (`shiftId = NULL`) ต้องตัดสินใจและทำ backfill/reconciliation ก่อนบังคับ production

## กติกาปิดงาน

ห้ามติ๊ก T ทั้งงานจากการแก้เพียง subtask; อัปเดต log คำสั่งและข้อจำกัดหลังแต่ละ batch งาน Android/hardware/deployment ต้องมีผลจริงจึงนับผ่าน การใช้ข้อมูลทดสอบไม่ใช่การ deploy ร้านจริง

## ผล Batch 01 — 11 กันยายน 2026

แก้ใน workspace แล้ว ยังไม่ได้ deploy production:

- Migration [0006_shift_history](../../apps/api/prisma/migrations/0006_shift_history/migration.sql) รักษาประวัติกะปิดและจำกัดกะเปิดหนึ่งกะต่อร้าน
- [ShiftService](../../apps/api/src/shifts/shift.service.ts) lock store ระหว่าง open/movement/close พร้อม audit ใน transaction เดียว; ปฏิเสธ CASH_OUT จำนวนบวก/CASH_IN จำนวนลบ/ศูนย์/ค่าผิดรูปแบบ โดยยังรองรับ signed contract ของ client เดิม
- [OrderService](../../apps/api/src/orders/order.service.ts) ตรวจ active item/unit ก่อน checkout
- [POS pricing](../../apps/pos/src/sale/pricing.ts) ใช้ domain engine, money strings/BigInt, tax/discount/total/change และ [หน้าขาย](../../apps/pos/app/index.tsx) ใช้ผลเดียวกัน พร้อม reset ส่วนลดเมื่อสำเร็จและปิด confirm เมื่อเงินรับไม่พอ
- เพิ่ม pricing tests 3 ข้อ, cash movement unit tests 2 ข้อ และ integration scenarios 2 ข้อ (10 รอบกะ/concurrent open/audit rollback และ disabled item/unit)

ผลตรวจ: lint/typecheck ผ่าน; unit 30 ข้อผ่าน (domain14/API13/POS3); PostgreSQL integration 7 ข้อผ่าน; API/Admin build และ Android JS export ผ่าน คำสั่งรอบสุดท้ายมี cache สำหรับ task ที่ inputs ไม่เปลี่ยน; รอบ force ก่อนหน้านั้นแนบไว้ด้วย

หลักฐาน: [checks](evidence/batch-01-checks.log), [integration](evidence/batch-01-integration.log), [migrations](evidence/batch-01-migrate.log), [build](evidence/batch-01-build.log), [final verification](evidence/batch-01-final.log)

**ข้อจำกัดที่ยังเปิด:** ยังไม่ผูก payment/order กับ shiftId, checkout ยังไม่ได้ร่วม store lock กับ close, ยังไม่มี server quote/version เพื่อกันราคาเปลี่ยนระหว่างเลือกกับจ่าย, ยังไม่ได้จำลอง UI reset บนอุปกรณ์จริง จึงไม่ติ๊ก T02/T03 ทั้งงานว่าเสร็จ และไม่ถือว่าผ่าน G1–G6

**ก่อนนำไปใช้กับ environment อื่น:** backup/test migration แล้วใช้ `prisma migrate deploy` ให้มี 0006 ก่อนเปิด API ใหม่ ไม่ใช้ schema reset การทดสอบครั้งนี้ใช้ PostgreSQL disposable ในเครื่องและไม่มีการแตะฐานข้อมูลร้านจริง

## งานถัดไปตาม dependency

1. T02: ledger/shiftId และ checkout-close consistency พร้อม tests S05/S06
2. T03: server quote/catalog version และ golden fixtures ส่วนที่เหลือ
3. T04: employee session + owner PIN + route guard ก่อนเปิดใช้งานหลายพนักงาน
4. T05–T08: durable checkout, outbox, offline reconciliation และ local isolation

## ผล Batch 02 — 11 กันยายน 2026

เพิ่ม migration `0007_shift_ledger` และผูก `Order`, `Payment`, `Refund` กับ `Shift` แบบ nullable เพื่อรองรับข้อมูล legacy; checkout/refund ล็อกแถว Store ก่อนทำ transaction และ checkout/payment ที่เกิดระหว่างกะจะเก็บ `shiftId`; expected cash รวม payment ตาม `shiftId`; เพิ่ม integration S05/S06 ตรวจการผูกกะและป้องกันปิดกะขณะมี `PENDING` sync operation

หลักฐานรอบนี้: `evidence/t02-checks.log`, `evidence/t02-integration.log`, `evidence/t02-migrate.log`

ข้อจำกัดที่ยังเปิด: checkout ที่ไม่มี active shift ยังรองรับ legacy โดยสร้างธุรกรรม `shiftId = NULL`; ก่อนเปิด production ต้องตัดสินใจเปิด strict policy และทำ backfill/reconciliation ข้อมูลเก่าให้เสร็จ งาน T02 จึงยังเป็น ◐

### T03 implementation evidence (2026-09-11)

- เพิ่ม `Store.catalogVersion` และ migration `apps/api/prisma/migrations/0008_catalog_version/migration.sql` เพื่อให้ catalog snapshot มี version ที่เพิ่มทุกครั้งเมื่อมีการสร้าง/แก้ไข/ลบ/ผูก catalog data
- เพิ่ม `POST /orders/quote` ซึ่งตรวจ `catalogVersion` และคำนวณ subtotal/discount/tax/total จากราคาสินค้าและ modifier ฝั่ง server
- checkout รองรับ `catalogVersion` และตอบ `CATALOG_VERSION_MISMATCH` เมื่อ snapshot เก่า
- เพิ่ม shared golden fixtures และ tests ที่ `packages/domain/test/golden-fixtures.spec.ts` (2 cases ผ่าน)
- POS บันทึก version จาก snapshot และส่งกลับใน checkout
- Verification: `pnpm exec turbo typecheck --force` ผ่านทุก package; domain tests 16 ผ่าน, POS tests 3 ผ่าน, API unit tests 13 ผ่าน (integration 8 tests ถูก skip เมื่อไม่มี `TEST_DATABASE_URL`)

**T03 limitation:** `catalogVersion` เป็น optional เพื่อรองรับเครื่อง POS/ข้อมูล legacy; หลัง rollout และ backfill แล้วควรเปลี่ยนเป็น required สำหรับ online checkout และเพิ่ม integration test quote→mutation→checkout mismatch บน PostgreSQL จริง

### T04 implementation evidence (2026-09-11)

- เพิ่มตาราง `EmployeeSession` และ migration `0009_employee_sessions` เก็บ token hash, employee, device, expiry และ revoke state
- `POST /employees/verify-pin` ตรวจ employee PIN, active device และคืน session credential อายุ 12 ชั่วโมง
- POS เก็บ credential ใน Expo SecureStore และส่ง `x-employee-session` อัตโนมัติ
- PermissionGuard ตรวจ session เมื่อมีการใช้ credential ป้องกันการสลับ employee/device header โดยไม่มี session ที่ตรงกัน
- PIN lockout เดิมยังคงทำงาน: ผิดครบ 5 ครั้งจะ lock แบบ exponential สูงสุด 60 นาที
- Verification: API typecheck/lint ผ่าน; API tests 15 ผ่าน (รวม PermissionGuard session tests), domain 16 ผ่าน, POS 3 ผ่าน

**T04 limitation:** เพื่อ compatibility กับ POS legacy guard ยังอนุญาต header เดิมเมื่อไม่มี `x-employee-session`; ก่อนเปิดหลายพนักงานต้องบังคับ session header, เพิ่ม refresh/revoke endpoint และทำ root boot/locked state ให้ครบ

### T05 implementation evidence (2026-09-11)

- POS persist checkout operation ลง SQLite outbox ก่อน network เสมอด้วย `clientOrderId` เดิม จึงกู้คืนได้หลัง process ตายหรือ response หาย
- สำเร็จแล้ว mark `ACKED`; network/timeout/5xx เปลี่ยนเป็น `PENDING` และ retry ได้; 4xx เปลี่ยนเป็น `FAILED_REVIEW` โดยไม่ล้างรายการขายเงียบ ๆ
- API client เพิ่ม AbortController timeout 15 วินาที และแยก network error เป็น status 0
- Order เก็บ `requestHash` migration `0010_checkout_request_hash`; clientOrderId เดิมพร้อม payload ต่างกันตอบ `CHECKOUT_PAYLOAD_CONFLICT`
- Sync push ตรวจ operationId เดิมพร้อม payload ต่างกันเป็น `OPERATION_PAYLOAD_CONFLICT` แทนการคืน ACK ปลอม
- Verification: workspace typecheck/tests ผ่านทั้งหมด (API 15, domain 16, POS 3); Prisma generate/validate ผ่าน

**T05 limitation:** ยังไม่มีหน้าจอ reconcile สำหรับ ambiguous order และยังไม่มี atomic local transaction ที่รวมการล้าง cart กับ ACK; งานเหล่านี้ควรปิดใน T06/T08 ก่อน production

### T06 implementation evidence (2026-09-11)

- Outbox ใช้ `next_retry_epoch` แบบ epoch milliseconds และ migrate ค่า retry timestamp เดิมตอน initialize
- retry delay ใช้ exponential backoff สูงสุด 1 ชั่วโมง พร้อม jitter 75–125%
- เพิ่ม `claimPendingOperations()` ที่ claim เป็น `SYNCING` แบบ conditional update พร้อม `syncing_until` lease 60 วินาที
- initialize กู้ `SYNCING` ที่ lease หมดอายุกลับเป็น `PENDING` หลัง app restart/crash
- sync worker ใช้ single-flight promise และไม่ย้อน ACKED เป็น PENDING เมื่อ pull ล้มเหลวหลัง push สำเร็จ
- Verification: workspace typecheck/tests ผ่านทั้งหมด; API tests 15, domain 16, POS 3 และ Prisma validate ผ่าน

**T06 limitation:** ยังไม่มี background worker ขณะ OS suspend และยังไม่มี integration test SQLite จริงสำหรับ crash ระหว่าง claim; ควรทดสอบบนอุปกรณ์จริงก่อน release

### T07 implementation evidence (2026-09-11)

- เพิ่ม `GET /sync/operations/:operationId/reconcile` ค้น operation และ order จาก `clientOrderId` เพื่อแก้ ambiguous result โดยไม่สร้างบิลซ้ำ
- Sync Center เพิ่มปุ่ม Reconcile แสดงว่าพบ order ฝั่ง server หรือยัง พร้อม refresh สถานะล่าสุด
- Offline outbox เก็บ `offlineLeaseExpiresAt` ณ เวลาขาย; server ยอมรับการ sync ล่าช้าถ้า occurredAtDevice อยู่ก่อน lease หมดอายุ
- Retry/review ยังคงแยกสถานะชัดเจน และ operation ที่ payload conflict จะไม่ถูก ACK
- Verification: API tests 16 ผ่าน (เพิ่ม reconcile test), domain 16 ผ่าน, POS 3 ผ่าน, API/POS lint และ typecheck ผ่าน

**T07 limitation:** ยังไม่มี local projection ของ order/stock จาก pull และยังไม่มี hard close-shift gate ที่ตรวจ queue ทุกเครื่องแบบครบถ้วน; ต้องปิดก่อน production

### T08 implementation evidence (2026-09-11)

- local DB initialization ใช้ migration transaction และบันทึก schema version หลัง migration สำเร็จ
- outbox มี tenant/store/device scope และ query จะอ่านเฉพาะ queue ของ context ปัจจุบัน ป้องกันส่งข้ามร้าน
- local cart แยกตาม tenant/store ทำให้ switch store ไม่เห็น cart ร้านเดิม
- stale `SYNCING` lease ถูกกู้คืนใน migration; ค่า retry timestamp เก่าถูกแปลงเป็น epoch
- session context เก็บ tenant/store/device ใน SecureStore และ local key ใช้ `crypto.getRandomValues` 32 bytes
- Verification: workspace typecheck ผ่าน; POS lint ผ่าน; API/domain/POS tests เดิมยังผ่าน

**T08 limitation:** Expo SQLite ใน build ปัจจุบันยังไม่ได้เปิด SQLCipher จริง และยังไม่มี device test สำหรับ migration rollback/disk-full/lost-key; ต้องทำ native encryption และ UAT ก่อน production

### T09 implementation evidence (2026-09-11)

- Refund ตรวจ manager/owner role และ PIN แยกจาก cashier actor; cashier ไม่สามารถอนุมัติเองได้
- refund transaction lock store row, ผูก payment reversal และ refund กับ active shift และเขียน audit event ระบุ cashier/manager/device/reason
- คืน stock ด้วย `multiplierSnapshot` ของ order line ผ่าน `toBaseQuantity` ไม่คำนวณจาก catalog ปัจจุบัน
- concurrent refund ที่ชน unique order constraint จะคืน refund เดิมแบบ idempotent แทน 500 หรือคืน stock ซ้ำ
- เพิ่ม regression tests fractional quantity และ negative quantity ใน `refund.service.spec.ts`
- Verification: API tests 18 ผ่าน, domain 16 ผ่าน, POS 3 ผ่าน; API lint/typecheck ผ่าน

**T09 limitation:** ยังใช้ manager PIN ใน request เดียว ยังไม่มี approval challenge token แบบจำกัด order/amount/expiry/one-time; ควรทำก่อนเปิด refund workflow ให้ cashier ใช้งานจริง

### T10 implementation evidence (2026-09-11)

- Settings เปลี่ยนจาก placeholder เป็น form จริง โหลดค่าจาก `GET /setup/store` และบันทึกผ่าน `PATCH /setup/store`
- แก้ไขชื่อร้าน ที่อยู่ เบอร์โทร และเลขผู้เสียภาษีได้ พร้อมแสดง currency LAK แบบแก้ไขไม่ได้
- เพิ่ม logout client ที่ revoke refresh session ฝั่ง server และล้าง token/session context ใน SecureStore
- session context หลัง signup/login เก็บ tenant/store เพื่อให้ local isolation ทำงานต่อเนื่อง
- เพิ่ม setup service tests ครอบคลุมการคืนค่า settings และ tenant-scoped update (`setup.service.spec.ts`)
- Verification: POS typecheck/lint ผ่าน, API typecheck ผ่าน; API tests รวม 20 ผ่านเมื่อรวม setup tests

**T10 limitation:** ยังไม่มี owner PIN setup/re-auth flow และ root boot state ที่ resume onboarding หลัง restart; email pending UI และ printer/device settings ยังต้องทำต่อ

### T11 implementation evidence (2026-09-11)

- Item editor รองรับ category, track stock, conversion, SKU/barcode และ validate ราคา/ตัวเลขก่อนส่ง API
- หน้า sale สร้าง product entry จากทุก unit ใน snapshot ไม่ตัดเหลือเฉพาะ unit แรก จึงขายแพ็ก/หน่วยย่อยตามข้อมูลจริงได้
- Modifier editor เพิ่ม required และ min/max selections พร้อมแก้ไขค่าจากข้อมูล server
- Tax editor สลับ mode `EXCLUSIVE`/`INCLUSIVE` และรักษาค่า mode ตอนแก้ไข
- Settings/catalog API client รองรับข้อมูล category id, trackStock และ modifier constraints
- Verification: POS typecheck/lint ผ่าน; domain/API tests เดิมผ่าน

**T11 limitation:** ยังไม่มี modifier picker แบบ interactive ในหน้า sale และ assignment ของ modifier group ต่อ item ยังไม่ถูกทำเป็น UI; ต้องปิดก่อน acceptance C03/C04 เต็มรูปแบบ

### T12 implementation evidence (2026-09-11)

- Barcode screen รองรับกล้องและ manual Barcode/SKU input พร้อม debounce lookup 250ms และแสดง not-found แยกชัดเจน
- Catalog sale ใช้ stable `unitId` จากทุก unit จึง lookup หน่วยแพ็ก/หน่วยย่อยได้ถูกต้อง
- Stock screen แสดงรายการด้วย `item.id` และเพิ่มฟอร์มปรับ stock รองรับบวก/ลบ, reason, manager employee ID/PIN และผลลัพธ์ล่าสุด
- API ปฏิเสธ zero quantity, non-stock-tracked item และ insufficient stock; adjustment เขียน inventory movement และ audit event ใน transaction เดียว
- Verification: POS typecheck/lint ผ่าน; API inventory tests เพิ่มเป็น 3 cases และผ่าน

**T12 limitation:** scanner ยังเป็นหน้าค้นหา ไม่ได้ส่ง `unitId` กลับไปเติม cart โดยตรง และยังไม่มี native permission/permanently-denied settings flow; ต้องปิดก่อน H01/H02 acceptance เต็มรูปแบบ

### T13 implementation evidence (2026-09-11)

- เพิ่ม SQLite `print_jobs` เก็บสถานะ `QUEUED → PRINTING → PRINTED/FAILED`, attempts และ error เพื่อ retry/review ได้โดยไม่สร้าง sale ใหม่
- `printReceipt` persist job ก่อนเชื่อมต่อ native printer และ mark failure ตามผลจริงของ connect/print
- Printer profile validate ชื่อ/ที่อยู่, LAN `host:port` และ paper width 58/80mm
- การบันทึก profile ที่เลือก auto-print จะปิด auto ของ profile อื่น เหลือ default เดียว
- Receipt reprint ยังคงใช้ receipt เดิมและรองรับ COPY label
- Verification: POS printer tests 5 ผ่าน, POS typecheck/lint ผ่าน, API/domain tests เดิมผ่าน

**T13 limitation:** ยังไม่มี native hardware suite สำหรับ Bluetooth/LAN หลายรุ่น, paper-out และ Lao glyph rasterization; ต้องทดสอบบน printer จริงก่อน release

### T14 implementation evidence (2026-09-11)

- Report range ตรวจ invalid/reversed dates และใช้ช่วงเวลาแบบ `[from,to)` ลด double-count ขอบเขตวัน
- CSV export เพิ่ม UTF-8 BOM และ flatten refund เป็น typed columns ไม่ส่ง nested JSON
- Reports UI เพิ่มตัวกรอง from/to, reload, error state และ CSV share/export
- API client รองรับ query date range และ text/csv response
- Verification: report tests 2 ผ่านรวม invalid range; API/POS typecheck และ lint ผ่าน

**T14 limitation:** report query หลักยังโหลด rows ผ่าน Prisma ก่อน aggregate และยังไม่มี pagination/cursor สำหรับประวัติจำนวนมาก; ต้องทำต่อใน performance gate T17

### T15 implementation evidence (2026-09-11)

- Shared `FormScreen` และ `ModulePlaceholder` เพิ่ม touch target ขั้นต่ำ 48dp สำหรับ back controls
- ลบ no-op actions จาก login/create-account/setup-store; error state กด dismiss ได้ และ forgot password มี feedback ชัดเจน
- Settings/catalog/stock/reports/barcode ใช้ loading, empty, error และ success feedback ตาม flow จริง
- Currency LAK ใน setup/settings เป็น readonly และ form fields แสดง label ชัดเจนไม่พึ่ง placeholder อย่างเดียว
- ปรับสินค้า/หน่วย/ตัวกรองให้ scroll และใช้งานบนหน้าจอเล็กได้ดีขึ้น
- Verification: POS typecheck/lint ผ่าน และตรวจ no-op handler ด้วย `rg` ไม่พบใน app routes

**T15 limitation:** ยังไม่ได้ทำ visual snapshot ทุก route, dark-theme parity และ TalkBack/device QA จริง ต้องเก็บภาพและทดสอบบน Android phone/tablet ก่อน release
