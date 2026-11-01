# Security Specification: Đơn nguyên Cơ xương khớp

## 1. System Invariants
- Access to clinical data (patients, vital records, schedules, duty reports, settings) is restricted to authenticated medical staff.
- User email `trungvp195@gmail.com` is configured as primary administrator.
- Document IDs must conform to valid string or alphanumeric identifiers.
- Writes require valid schema fields and bounded string lengths.

## 2. Test Payloads ("Dirty Dozen")
1. Unauthenticated read/write to /patients/123 -> Denied.
2. Unauthenticated read/write to /recs/123 -> Denied.
3. Unauthenticated read/write to /scheds/123 -> Denied.
4. Unauthenticated read/write to /reports/123 -> Denied.
5. Authenticated staff reading patients -> Allowed.
6. Authenticated staff creating/updating patient record -> Allowed.
7. Authenticated staff adding vital records -> Allowed.
8. Authenticated staff creating procedure schedule -> Allowed.
9. Authenticated staff saving duty report -> Allowed.
10. Malformed payload with oversized fields -> Denied.
11. Malformed document ID injection -> Denied.
12. Random unauthorized path write -> Denied by global catch-all.
