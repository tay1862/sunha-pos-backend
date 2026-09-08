# Sunha POS — Production Readiness Plan

## Goal

ยกระดับ Sunha POS จาก technical prototype ให้ผ่าน 4 release gates: Public Beta, รับร้านค้าจริง, รับเงินจริง และ Offline sale ที่ตรวจสอบย้อนหลังได้อย่างปลอดภัย

## Release gates

1. **Public Beta Ready** — ร้านทดลองใช้งานได้ครบ online flow, ไม่มี P0/P1, มี monitoring และ rollback
2. **Merchant Ready** — เจ้าของสร้างร้าน เพิ่มพนักงาน/สินค้า เปิดกะ ขาย พิมพ์ใบเสร็จ ดูรายงาน และคืนเงินได้จริง
3. **Money Ready** — ยอดเงิน/ภาษี/ส่วนลด/เงินทอนถูกต้อง, duplicate-safe, audit ครบ, backup restore ผ่าน
4. **Offline Ready** — อุปกรณ์เดียวขาย offline ได้, sync แล้วไม่หาย/ไม่ซ้ำ, lease/revoke/conflict ทำงาน และมี review queue

## Phase 0 — Baseline และ safety gate

- [ ] แยก `local`, `staging`, `production` และสร้าง Prisma migrations แทน `db push` → Verify: deploy staging ด้วย `prisma migrate deploy` ได้
- [ ] Rotate VPS root password, ใช้ SSH key, แยก secret และตั้ง domain/HTTPS → Verify: API public ผ่าน HTTPS เท่านั้น
- [ ] แก้ high dependency vulnerabilities และ pin image/dependency → Verify: `pnpm audit --prod` ไม่มี High ที่ยอมรับไม่ได้
- [ ] เพิ่ม API rate limit, body size limit, security headers, structured redacted logs และ Sentry → Verify: login brute force/oversized body ถูกปฏิเสธและมี alert
- [ ] กำหนด backup retention, restore drill และ rollback runbook → Verify: restore database บน staging สำเร็จ

## Phase 1 — Identity, tenant และสิทธิ์

- [x] สร้าง owner employee/device เริ่มต้นพร้อม signup transaction → Verify: สมัครแล้วเข้าสู่การขายได้โดยไม่ต้องแก้ฐานข้อมูล
- [x] ทำ Employee/Role/Permission/Device invitation, enrollment, revoke และ lease ครบ → Verify: device/employee ข้ามร้านหรือสิทธิ์ไม่ได้
- [x] ทำ authorization guard กลาง ตรวจ tenant + store + role/permission + actor/device ทุก mutation → Verify: IDOR, cashier escalation และ forged headers ผ่านไม่ได้
- [x] เพิ่ม email verification, password reset, session revoke และ PIN lockout → Verify: token/session ที่ revoke ใช้ไม่ได้ (ยังเหลือ email delivery provider จริง)

> สถานะล่าสุด: signup สร้าง owner employee และ owner device ที่ active พร้อมผูกสิทธิ์และ offline lease แล้ว; เพิ่ม email verification/password-reset token แบบใช้ครั้งเดียว, Resend email delivery adapter, logout/revoke session, PIN lockout แบบสะสมความผิดพลาด และบังคับ `x-device-id` ที่ active และอยู่ร้านเดียวกันใน protected business routes แล้ว เหลือการตั้งค่า Resend production secret/domain และทดสอบส่งจริงก่อนเปิดใช้งานเชิงพาณิชย์

## Phase 2 — Catalog, pricing และ inventory correctness

- [x] เชื่อม POS กับ catalog API/local catalog และทำหน้าจอสร้าง/ดู categories/items/modifiers/taxes/employees → Verify: owner สร้างข้อมูลจากแอปและโหลดข้อมูลจาก API ได้
- [x] ขยาย catalog เป็น full CRUD สำหรับ edit/delete และ unit editor ทุกโมดูล → Verify: owner แก้ไข/ปิดใช้งานข้อมูลจากแอปได้ครบโดยไม่เปลี่ยน snapshot เก่า
- [x] รวม pricing engine package เดียวกับ API รองรับ modifier, inclusive/exclusive tax, discount และ rounding → Verify: golden test ชุดเดียวผ่าน mobile/server
- [x] ทำ unit conversion snapshot และป้องกันการแก้ conversion ย้อนหลัง → Verify: แพ็ก/ลังตัด base stock ถูกต้องและ receipt เก่าไม่เปลี่ยน
- [x] ทำ stock ledger แบบ transaction-safe, adjustment approval, negative-stock policy และ duplicate barcode error → Verify: concurrent sale ไม่ทำ stock ติดลบ

> สถานะล่าสุด: เพิ่ม modifier group/option, item assignment, validation ของ required/min/max และ snapshot ราคา modifier ใน order line แล้ว เพิ่ม policy ป้องกัน stock ติดลบ, ปฏิเสธ adjustment กับสินค้าที่ไม่ track stock และ map duplicate SKU/barcode เป็น conflict แล้ว รวมถึง Manager PIN + audit สำหรับ stock adjustment. POS มีหน้าจอสร้าง/ดูรายการสำหรับสินค้า/หมวดหมู่, modifier, ภาษี และพนักงาน พร้อมเชื่อม API จริง; full edit/delete และ unit editor ยังเป็นงานถัดไป. PostgreSQL concurrent integration test รันผ่านจริงแล้วด้วย PostgreSQL 17 ใน isolated Docker database
> ความคืบหน้าล่าสุด: เพิ่ม item/category soft-delete, item edit และแก้ไข unit name/conversion/price/SKU/barcode แบบรักษา unit id เดิมเพื่อไม่กระทบ snapshot ของ order เก่า พร้อมฟอร์ม POS ที่ใช้งานจริง; modifier/tax/employee full edit/delete ยังเหลือ
> ความคืบหน้าล่าสุด: เพิ่ม API และ POS UI สำหรับ modifier/tax/employee edit/delete; modifier ที่มีประวัติขายจะลบไม่ได้, tax/employee ใช้ soft-delete. Item/category edit/delete และ unit editor ทำงานแล้ว จึงปิดงาน Catalog CRUD ตามขอบเขต Beta

> ความคืบหน้าล่าสุด: เพิ่ม catalog snapshot สำหรับ POS และ SQLite local cache พร้อม online-first/fallback read, บังคับ Manager PIN + audit สำหรับ stock adjustment และเพิ่ม test สำหรับ net sales หลัง refund; ยังไม่ mark catalog/stock complete จนกว่า POS CRUD, PostgreSQL integration และ reconciliation flow จะผ่านจริง

## Implementation log

- 2026-09-06: เพิ่ม API hardening, Prisma migration baseline, employee/device onboarding และ permission guard สำหรับ protected routes
- 2026-09-06: แก้ canonical pricing, inclusive/exclusive tax และ stock unit conversion; online VPS smoke test ผ่าน (`2 แพ็ก × 6 = 12`, stock เหลือ 0)
- 2026-09-06: ทดสอบ permission บน VPS: Owner สร้าง category ได้, Cashier ได้ `403` เมื่อสร้าง category/report และ PIN/invitation reuse ถูกปฏิเสธตาม policy
- 2026-09-06: เพิ่ม migration `0002_identity_modifiers`, email/password recovery foundation, PIN lockout, active-device context, modifier assignment/snapshot และ negative-stock policy; local typecheck/test/lint ผ่าน (API 7 tests)
- 2026-09-06: build image ใหม่และ deploy VPS ด้วย `prisma migrate deploy` สำเร็จ; migration `0002_identity_modifiers` ถูก apply, API/PostgreSQL healthy และ readiness check ผ่าน
- 2026-09-06: เพิ่ม owner-device bootstrap ใน signup transaction และตรวจ typecheck/test/lint ซ้ำผ่าน (API 7 tests)
- 2026-09-06: เพิ่ม Resend email adapter, catalog snapshot + SQLite local cache และบังคับ Manager PIN/audit สำหรับ stock adjustment; local typecheck/test/lint ผ่าน (API 7 tests)
- 2026-09-06: เพิ่ม payment reversal ledger ตอน full refund และหัก refund ออกจาก net sales report; เพิ่ม PostgreSQL concurrent checkout integration test harness (ยัง skip หากไม่มี `RUN_INTEGRATION=true` + PostgreSQL)
- 2026-09-06: เพิ่ม POS screens สำหรับ modifier, tax และ employee และเชื่อม catalog item/category create/list กับ API จริง; local typecheck/test ผ่าน แต่ catalog CRUD ยังไม่ complete เพราะ edit/delete/unit editor ยังเหลือ
- 2026-09-06: แก้ concurrent checkout integration expectation ให้ยอมรับผลที่ถูกต้องเมื่อคำขอหนึ่งชน stock guard (`INSUFFICIENT_STOCK`) และตรวจ retry ด้วย `clientOrderId` ว่าได้ order เดิมโดยไม่สร้าง receipt ซ้ำ; local lint/typecheck/test ผ่าน
- 2026-09-06: รัน migration และ API integration suite กับ PostgreSQL 17 จริงบน VPS ใน database/network/volume ชั่วคราวแบบ isolated; ผ่าน 5 test files และ 9 tests รวม concurrent checkout, จากนั้น cleanup resource สำเร็จ
- 2026-09-06: รัน `pnpm --filter @sunha/pos build` สำเร็จด้วย Expo Android export; routes ของ catalog/modifier/tax/employee bundle ได้จริง (ยังต้องทดสอบบนอุปกรณ์ Android/เครื่องพิมพ์จริง)
- 2026-09-06: เพิ่ม Catalog item edit/soft-delete, category delete และ unit editor สำหรับชื่อ/ราคา/conversion/SKU/barcode; typecheck, lint และ Android export ผ่าน
- 2026-09-06: เพิ่มตัวแปร Resend ใน production compose โดยอ้างอิงจาก environment เท่านั้น และกำหนด temporary `APP_BASE_URL` default เป็น `http://kanghan.site` กับ test sender `onboarding@resend.dev`; ยังไม่ใส่ secret/deploy เพราะต้องตรวจ sender/domain ของ Resend ก่อน
- 2026-09-06: ตั้งค่า Resend บน VPS สำเร็จและ deploy API ด้วย project `sunha-pos-prod`; migration ไม่มีรายการค้าง, readiness/database ผ่าน และส่ง test email ไปยัง Resend account owner สำเร็จ (custom recipient ยังถูกปฏิเสธจนกว่า `kanghan.site` จะ verified)
- 2026-09-06: เพิ่ม Catalog API update/delete สำหรับ modifier group และ tax; local typecheck/test/lint ผ่าน แต่ยังไม่ deploy เพราะต้องปิด UI CRUD ให้ครบก่อน
- 2026-09-06: เพิ่ม POS UI edit/delete สำหรับ modifier, tax และ employee; typecheck, lint, unit tests และ Android export ผ่าน จึงติ๊ก Catalog full CRUD ตามขอบเขต Beta
- ยังไม่เปิดรับเงินจริงหรือประกาศ Production Ready จนกว่า Phase 1–8 และ release gates จะผ่านครบ

## Phase 3 — Online sale และเงินจริง

- [x] เชื่อม cart/modifier/discount/tax กับ `POST /orders/checkout` จริง → Verify: POS โหลด catalog จริง, cart ส่ง item/unit/modifier/discount เข้า API และไม่มี mock cart ใน production flow
- [x] Server คำนวณราคาและ tax จากข้อมูลร้าน ไม่เชื่อยอดจาก client → Verify: checkout resolve ราคา/ตัวเลือก/ภาษีจาก tenant ใน transaction และคำนวณ cash change ใหม่บน server
- [x] ทำ payment cash/change/manual QR/transfer/card พร้อม reference และ `UNVERIFIED` → Verify: payment types ถูกบันทึกพร้อม reference, manual QR เป็น `UNVERIFIED`, insufficient cash ถูกปฏิเสธ และ change ใช้ integer LAK
- [x] ทำ immutable receipt number, receipt history, reprint และ copy receipt → Verify: receipt API/UI อ่านประวัติ, reprint/copy ใช้ receipt เดิม และ retry ด้วย `clientOrderId` ไม่สร้าง receipt ซ้ำ (การส่งเข้าเครื่องพิมพ์จริงอยู่ Phase 6)
- [x] ทำ full refund online ด้วย manager approval, reason, stock/cash reversal และ audit → Verify: API/UI บังคับ Manager PIN + reason, refund ซ้ำ/cashier refund ถูกปฏิเสธ, stock/payment reversal และ audit ถูกสร้างใน transaction

> สถานะ 2026-09-06: Phase 3 implementation อยู่ใน commit `b8994bb` และ deploy production แล้ว. Local typecheck/lint ผ่าน, unit tests 9 ผ่าน, Android export ผ่าน; PostgreSQL 17 integration suite บน VPS ผ่าน 5 test files / 11 tests รวม concurrent checkout, manual QR reconciliation, immutable receipt และ full refund. Printer hardware, Android device E2E และ offline sale ยังไม่ถือว่าผ่านจนกว่าจะตรวจใน Phase 5–6

## Phase 4 — Shift และ fraud controls

- [x] ทำ shared shift, cash in/out, blind close และ expected cash ที่รวม refund ถูกต้อง → Verify: เปิด/ปิดกะซ้ำหรือปิดขณะ pending ไม่ได้
- [x] ผูกทุก event กับ authenticated employee/device/server time และ audit append-only → Verify: รายงานระบุ actor/device/reason/approver ครบ
- [x] ทำ reports sales/payment/discount/refund/shift/employee/device/stock และ CSV → Verify: ยอดรายงาน reconcile กับ receipt ledger

> สถานะ 2026-09-06: Phase 4 implementation อยู่ใน commit `6cdfe33` และ deploy production แล้ว. เพิ่ม migration `0003_audit_device`, shared-shift API/UI, blind-close pending guard, audit device/server time, report endpoints และ CSV export. PostgreSQL 17 integration suite ผ่าน 5 test files / 12 tests รวมเปิดกะ, cash movement, expected cash, เปิด/ปิดกะซ้ำ และ reconciliation กับ refund/payment ledger

## Phase 5 — Offline-first จริง

- [ ] ใช้ encrypted SQLite/Keystore, local catalog/cart และ schema version migration → Verify: app restart/upgrade ไม่ทำข้อมูลหาย (local SQLite/cart/catalog schema migration ทำแล้ว; SQLCipher native encryption ยังต้องทำใน Android release build)
- [x] ทำ offline checkout transaction ที่เขียน order + stock effect ลง outbox ก่อนแสดง success → Verify: outbox เขียนก่อนแจ้งสำเร็จ, server replay คำนวณ order/stock จริง และ clientOrderId กันซ้ำ (unit + PostgreSQL integration รอรันบน VPS)
- [x] ทำ sync push/pull พร้อม idempotency, dependency ordering, cursor, retry/backoff และ conflict review → Verify: operation ordering, cursor แบบ createdAt+id, retry/backoff, timeout/process-kill recovery และ FAILED_REVIEW ถูกวางไว้ (unit ผ่าน; PostgreSQL integration รอรันบน VPS)
- [x] บังคับ policy device เดียว/หลาย device, lease 24 ชั่วโมง และ revoke behavior → Verify: API ตรวจ ACTIVE/lease/จำนวน selling device และส่ง expired/multi-device เข้า FAILED_REVIEW (unit ผ่าน; PostgreSQL integration รอรันบน VPS)
- [x] ทำ Sync Center สำหรับ pending/failed/review พร้อม recovery action → Verify: POS แสดงรายการจาก `/sync/operations` และ manager retry ประมวลผล operation เดิมโดยไม่แก้ receipt (typecheck/lint ผ่าน)

> สถานะ 2026-09-06: implementation อยู่ใน commit `a6df176` และ push ไป GitHub แล้ว. Local typecheck/lint ผ่าน และ unit tests 11 ผ่าน. PostgreSQL integration ถูกเพิ่มสำหรับ offline replay/idempotency/lease/multi-device แต่ยังต้องรันใน PostgreSQL จริงบน VPS ก่อนติ๊กเป็น production-verified. Stock Expo SQLite ถูกย้ายเป็น shared local DB มี schema version, local cart, catalog cache, outbox recovery และ SecureStore key provisioning; SQLCipher ยังไม่ถือว่าผ่านจนกว่าจะทำ native Android encryption build จริง

## Phase 6 — Hardware และ operational UX

- [ ] ทำ native ESC/POS Bluetooth/LAN module, printer profiles, 58/80mm, auto print/test/reprint/copy → Verify: ทดสอบ printer อย่างน้อย 2 รุ่นต่อประเภท
- [x] ทำ barcode camera และค้นหาสินค้าด้วย barcode/SKU → Verify: barcode ซ้ำ/ไม่รู้จักมีข้อความชัดเจน
- [ ] ทำ loading/offline/error/empty states, Lao copy, accessibility และ responsive phone/tablet → Verify: manual UX review ผ่านบน Android จริง

> สถานะ 2026-09-06: เพิ่ม `SunhaPrinter` Android native module สำหรับ Bluetooth RFCOMM/LAN TCP, printer profiles, auto-print setting, test/reprint/copy receipt และ permission สำหรับ Android 12+. เพิ่ม Barcode camera ที่ค้นหาจาก catalog ด้วย barcode/SKU และข้อความกรณีไม่พบ รวมถึง empty state ของรายการสินค้า/ใบเสร็จและ accessibility labels บางจุด. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `expo export --platform android` และ `./gradlew :app:compileDebugKotlin` ผ่านแล้ว. ยังไม่ได้ทดสอบกับเครื่องพิมพ์ Bluetooth จริง 2 รุ่น, LAN จริง, กระดาษ/ฟอนต์ Lao หรือ Android E2E; จึงยังไม่ติ๊ก hardware/UX verification เป็น production-ready. ใบเสร็จที่พิมพ์จากหน้าประวัติปัจจุบันเป็น summary เพราะ receipt list API ยังไม่ได้ส่ง line details สำหรับ full itemized print

## Phase 7 — Observability และ launch operations

- [ ] เพิ่ม health/readiness, Sentry crash, metrics สำหรับ checkout/sync/receipt/printer และ alert → Verify: จำลอง error แล้ว alert ภายใน SLA
- [x] ทำ Internal Admin ที่มี MFA, suspend store, device/sync/audit view โดยแก้ receipt ไม่ได้ → Verify: admin action ถูก audit และ tenant isolation ผ่าน (MFA gate ใช้ admin token + MFA token แยกกัน; ต้องตั้ง secret และทดสอบ production ก่อนเปิดใช้งาน)
- [x] ตั้ง CI quality gates, dependency scan, migration check, image scan และ deploy rollback → Verify: pull request ที่ test/security fail merge ไม่ได้ (เพิ่ม Prisma schema validation, production dependency audit และ Trivy image scan ใน CI; เปิด branch protection บน `main` แล้ว)

> สถานะ 2026-09-08: เพิ่ม in-process operational metrics ที่ `/v1/health/metrics` สำหรับ request/error และเส้นทาง checkout/sync/receipt/printer พร้อม hook บันทึกหลัง response โดยไม่เก็บ payload หรือข้อมูลลับ. Sentry React Native wizard ทำงานสำเร็จใน `apps/pos` และตั้ง `sendDefaultPii=false`; auth/source-map token อยู่ในไฟล์ ignored เท่านั้น. Backend production env บน VPS ตั้ง admin token, MFA token และ Sentry DSN แบบ permission 600 แล้ว; migration `0005_admin_operations` และ database backup ก่อน migration สำเร็จ, API image `12ae419` healthy. Admin no-header/wrong-header ถูกปฏิเสธ และ valid admin overview ผ่าน; ยังไม่ suspend ร้านจริงเพื่อหลีกเลี่ยงผลกระทบกับข้อมูลลูกค้า และ tenant isolation แบบสอง tenant ต้องทดสอบด้วย test tenants แยก. Sentry alert rule ยังตั้งไม่ได้เพราะ token ปัจจุบันไม่มี permission สำหรับ alert API; HTTPS smoke ยังติด domain/SNI ที่ `kanghan.site` ไม่ได้ชี้/ตั้ง TLS มายัง VPS. เปิด GitHub `main` branch protection (PR review 1, required checks `verify`/`Scan API image`, no force-push/delete) และเพิ่ม Trivy scan แล้ว; ต้องให้ workflow รันผ่านจริงก่อนถือเป็น verified

## Phase 8 — Test program

- [ ] Unit/property tests: money, tax, discount, modifier, conversion, stock, receipt number
- [ ] Integration tests ด้วย PostgreSQL จริง: tenant isolation, auth, permissions, checkout, refund, shift และ migrations
  - [x] Checkout concurrency + migration smoke test ผ่านบน PostgreSQL 17 จริง; auth/refund/shift integration coverage ยังเหลือ
- [ ] Sync fault-injection tests: timeout, duplicate, out-of-order, app kill, full storage, expired lease, revoked device
- [ ] Android E2E: onboarding → employee → catalog → shift → sale → receipt → refund → close shift
- [ ] Hardware tests: Bluetooth disconnect, IP change, paper out, Lao font, app close during print
- [ ] Load/security tests: rate limit, IDOR, brute force, token replay, payload limits, dependency scan

## Done when

- [ ] ไม่มี Critical/High vulnerability ที่ยังไม่มี mitigation
- [ ] ไม่มี lost sale หรือ duplicate receipt ใน fault-injection suite
- [ ] Cross-tenant และ authorization tests ผ่าน 100%
- [ ] Receipt, payment, refund, stock และ shift reconcile กันได้
- [ ] Crash-free sessions ≥99.5%, sync success ≥99.9%, checkout success ≥99.5%
- [ ] ร้านใหม่ขายครั้งแรกได้ภายใน 15 นาที
- [ ] Backup restore และ rollback ผ่านจริง
- [ ] Pilot อย่างน้อย 5 ร้านใช้งานต่อเนื่อง 30 วัน
- [ ] Android production build signed และเชื่อม API ผ่าน HTTPS

## Recommended execution order

ทำตามลำดับ Phase 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 โดยแต่ละ phase ต้องผ่าน verification ก่อนเริ่ม phase ถัดไป ยกเว้นงานเอกสาร/monitoring ที่ทำขนานได้
