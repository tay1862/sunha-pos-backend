# Release และ pilot runbook

ใช้กับ release candidate เท่านั้น และห้ามชี้คำสั่ง backup/restore ไป production โดยไม่เปิด incident/change record

## X02 backup และ restore drill

1. บันทึก `git commit`, API image digest, app build, Prisma migration version และเวลา UTC ก่อน backup
2. สร้างฐานข้อมูล disposable ใหม่ แล้วเก็บ backup แบบ custom format:

```bash
export TEST_DB="sunha_restore_$(date -u +%Y%m%d%H%M%S)"
createdb "$TEST_DB"
pg_dump --format=custom --no-owner --file="${TEST_DB}.dump" "$DATABASE_URL"
createdb "${TEST_DB}_restored"
pg_restore --exit-on-error --no-owner --dbname="${TEST_DB}_restored" "${TEST_DB}.dump"
DATABASE_URL="postgresql://.../${TEST_DB}_restored" pnpm --filter @sunha/api exec prisma migrate deploy
```

3. รัน fixture/integration suite บนฐาน restore และเปรียบเทียบจำนวน/ยอด `Tenant`, `Order`, `Payment`, `Refund`, `InventoryMovement`, `SyncOperation` กับฐานต้นทาง
4. ตรวจ migration status, login, checkout idempotency, refund และ report total; เก็บ start/end time, command log และ checksum โดยลบ token/PIN ออกจากหลักฐาน
5. ลบ disposable database หลัง reviewer ลงชื่อ ห้ามใช้ `prisma migrate reset` กับฐานจริง

## X03 offline queue compatibility

- ก่อน upgrade บันทึก outbox ที่มี `PENDING`, `FAILED_REVIEW` และ `ACKED` พร้อม schema/app version
- เปิด app รุ่นใหม่ด้วย database copy เดิม แล้วตรวจ local migration สำเร็จแบบ transaction เดียว; queue เดิมต้องคง `operationId`, `clientOrderId`, payload hash และ retry state
- เปิด API รุ่นใหม่และ sync: operation เดิมต้อง ACK ได้ครั้งเดียว, conflict ต้องเข้า review, ห้ามสร้าง order/stock ซ้ำ
- หาก upgrade ไม่ผ่าน ให้หยุด rolloutและกลับไป app/API รุ่นที่ระบุว่า compatible; ห้ามล้าง app data หรือ queue เพื่อแก้ปัญหา
- เก็บผลก่อน/หลัง, migration version, order/payment/stock counts และ correlation ID เป็นหลักฐาน

## Pilot 7 วัน

ใช้ร้านทดสอบหนึ่งร้านและเครื่องหนึ่งเครื่องตาม policy offline ทำอย่างน้อย 2 กะต่อวัน กระทบยอด cash/payment/refund/stock ทุกวัน ผู้ทดสอบลงชื่อใน UAT template และเปิด incident เมื่อพบ duplicate/lost sale, tenant ผิด, ยอดต่างอธิบายไม่ได้, queue ค้างเกิน SLA หรือ printer/hardware failure ที่ไม่มี recovery

## Release gates G1–G6

ไม่อนุมัติ rollout จนกว่าจะมีหลักฐานของเงิน/stock, identity/data, screen QA, hardware, operations และ pilot ครบตามตารางใน `UAT-AND-RELEASE.md`; `BLOCKED` หรือ `NOT RUN` นับเป็นยังไม่ผ่าน
