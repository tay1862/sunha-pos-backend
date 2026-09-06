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

- [ ] สร้าง owner employee/device เริ่มต้นพร้อม signup transaction → Verify: สมัครแล้วเข้าสู่การขายได้โดยไม่ต้องแก้ฐานข้อมูล
- [ ] ทำ Employee/Role/Permission/Device invitation, enrollment, revoke และ lease ครบ → Verify: device/employee ข้ามร้านหรือสิทธิ์ไม่ได้
- [ ] ทำ authorization guard กลาง ตรวจ tenant + store + role/permission + actor/device ทุก mutation → Verify: IDOR, cashier escalation และ forged headers ผ่านไม่ได้
- [ ] เพิ่ม email verification, password reset, session revoke และ PIN lockout → Verify: token/session ที่ revoke ใช้ไม่ได้

> สถานะล่าสุด: signup สร้าง Owner employee, employee PIN verification, device invitation แบบใช้ครั้งเดียว (10 นาที), enrollment, revoke และ offline lease (24 ชั่วโมง) ใช้งานแล้ว และทดสอบ cashier escalation/tenant scope ของ employee/device ผ่านบน VPS แล้ว แต่ยังไม่ mark phase complete จนกว่าจะสร้าง owner device อัตโนมัติ, บังคับ device context ให้ครบทุก mutation, ทำ email verification/password reset และ PIN lockout แบบสะสมความผิดพลาด

## Phase 2 — Catalog, pricing และ inventory correctness

- [ ] เชื่อม POS กับ catalog API/local catalog และทำ CRUD categories/items/units/modifiers/taxes → Verify: owner สร้างข้อมูลจากแอปได้ครบ
- [ ] รวม pricing engine package เดียวกับ API รองรับ modifier, inclusive/exclusive tax, discount และ rounding → Verify: golden test ชุดเดียวผ่าน mobile/server
- [ ] ทำ unit conversion snapshot และป้องกันการแก้ conversion ย้อนหลัง → Verify: แพ็ก/ลังตัด base stock ถูกต้องและ receipt เก่าไม่เปลี่ยน
- [ ] ทำ stock ledger แบบ transaction-safe, adjustment approval, negative-stock policy และ duplicate barcode error → Verify: concurrent sale ไม่ทำ stock ติดลบ

> สถานะล่าสุด: online checkout ใช้ pricing engine กลางและตัด stock แบบ transaction-safe แล้ว ทดสอบ `2 แพ็ก × 6 = 12` บน VPS ผ่าน เหลือ modifier snapshot, approval policy, duplicate barcode response และ concurrent integration tests

## Implementation log

- 2026-09-06: เพิ่ม API hardening, Prisma migration baseline, employee/device onboarding และ permission guard สำหรับ protected routes
- 2026-09-06: แก้ canonical pricing, inclusive/exclusive tax และ stock unit conversion; online VPS smoke test ผ่าน (`2 แพ็ก × 6 = 12`, stock เหลือ 0)
- 2026-09-06: ทดสอบ permission บน VPS: Owner สร้าง category ได้, Cashier ได้ `403` เมื่อสร้าง category/report และ PIN/invitation reuse ถูกปฏิเสธตาม policy
- ยังไม่เปิดรับเงินจริงหรือประกาศ Production Ready จนกว่า Phase 1–8 และ release gates จะผ่านครบ

## Phase 3 — Online sale และเงินจริง

- [ ] เชื่อม cart/modifier/discount/tax กับ `POST /orders/checkout` จริง → Verify: ไม่มี mock product/cart เหลือใน production flow
- [ ] Server คำนวณราคาและ tax จากข้อมูลร้าน ไม่เชื่อยอดจาก client → Verify: แก้ราคา/discount/tax ใน request แล้ว server ปฏิเสธหรือคำนวณใหม่
- [ ] ทำ payment cash/change/manual QR/transfer/card พร้อม reference และ `UNVERIFIED` → Verify: ยอดรวม/เงินทอนตรงทุก boundary case
- [ ] ทำ immutable receipt number, receipt history, reprint และ copy receipt → Verify: retry ทุกแบบได้ receipt เดิม ไม่สร้างซ้ำ
- [ ] ทำ full refund online ด้วย manager approval, reason, stock/cash reversal และ audit → Verify: cashier refund เองไม่ได้และ refund ซ้ำไม่ได้

## Phase 4 — Shift และ fraud controls

- [ ] ทำ shared shift, cash in/out, blind close และ expected cash ที่รวม refund ถูกต้อง → Verify: เปิด/ปิดกะซ้ำหรือปิดขณะ pending ไม่ได้
- [ ] ผูกทุก event กับ authenticated employee/device/server time และ audit append-only → Verify: รายงานระบุ actor/device/reason/approver ครบ
- [ ] ทำ reports sales/payment/discount/refund/shift/employee/device/stock และ CSV → Verify: ยอดรายงาน reconcile กับ receipt ledger

## Phase 5 — Offline-first จริง

- [ ] ใช้ encrypted SQLite/Keystore, local catalog/cart และ schema version migration → Verify: app restart/upgrade ไม่ทำข้อมูลหาย
- [ ] ทำ offline checkout transaction ที่เขียน order + stock effect ลง outbox ก่อนแสดง success → Verify: airplane mode ขายได้และปิดแอปทันทีไม่หาย
- [ ] ทำ sync push/pull พร้อม idempotency, dependency ordering, cursor, retry/backoff และ conflict review → Verify: timeout, duplicate, out-of-order และ process kill ไม่สร้างซ้ำ
- [ ] บังคับ policy device เดียว/หลาย device, lease 24 ชั่วโมง และ revoke behavior → Verify: lease หมดอายุหรือ device ถูก revoke แล้ว offline sale ถูกหยุด/เข้า review ตาม policy
- [ ] ทำ Sync Center สำหรับ pending/failed/review พร้อม recovery action → Verify: operator แก้ failed operation ได้โดยไม่แก้ receipt เดิม

## Phase 6 — Hardware และ operational UX

- [ ] ทำ native ESC/POS Bluetooth/LAN module, printer profiles, 58/80mm, auto print/test/reprint/copy → Verify: ทดสอบ printer อย่างน้อย 2 รุ่นต่อประเภท
- [ ] ทำ barcode camera และค้นหาสินค้าด้วย barcode/SKU → Verify: barcode ซ้ำ/ไม่รู้จักมีข้อความชัดเจน
- [ ] ทำ loading/offline/error/empty states, Lao copy, accessibility และ responsive phone/tablet → Verify: manual UX review ผ่านบน Android จริง

## Phase 7 — Observability และ launch operations

- [ ] เพิ่ม health/readiness, Sentry crash, metrics สำหรับ checkout/sync/receipt/printer และ alert → Verify: จำลอง error แล้ว alert ภายใน SLA
- [ ] ทำ Internal Admin ที่มี MFA, suspend store, device/sync/audit view โดยแก้ receipt ไม่ได้ → Verify: admin action ถูก audit และ tenant isolation ผ่าน
- [ ] ตั้ง CI quality gates, dependency scan, migration check, image scan และ deploy rollback → Verify: pull request ที่ test/security fail merge ไม่ได้

## Phase 8 — Test program

- [ ] Unit/property tests: money, tax, discount, modifier, conversion, stock, receipt number
- [ ] Integration tests ด้วย PostgreSQL จริง: tenant isolation, auth, permissions, checkout, refund, shift และ migrations
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
