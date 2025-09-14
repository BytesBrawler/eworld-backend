# Balance Type Implementation

## Summary
Added `balance_type` column usage to `bal_transactions` table with the following logic:

## Balance Type Rules

### 1. Online Payments → `transfer`
- When users make online payments (payment gateway transactions)
- `transaction_type = 'online'` → `balance_type = 'transfer'`

### 2. Current Parent Transfers → `transfer`
- When a parent user transfers balance to their child users
- Parent role > 2 and operation is adding balance → `balance_type = 'transfer'`

### 3. Current Parent Withdraws → `withdraw`
- When a parent user withdraws balance from their child users
- Parent role > 2 and operation is withdrawal → `balance_type = 'withdraw'`

### 4. Admin/SuperAdmin Operations
- **Admin/SuperAdmin Add Balance** → `credit`
  - When admin (role ≤ 2) adds balance to users → `balance_type = 'credit'`
- **Admin/SuperAdmin Withdraw Balance** → `debit`
  - When admin (role ≤ 2) withdraws balance from users → `balance_type = 'debit'`

### 5. Refunds → `credit`
- When admin refunds failed transactions → `balance_type = 'credit'`

## Files Modified

1. **`/backend/src/db/queries.js`**
   - Updated `addBalanceTransaction()` function to accept `balance_type` parameter
   - Added `balance_type` to INSERT query
   - Updated refund transaction insertion

2. **`/backend/src/controllers/wallet.controllers.js`**
   - Added `getBalanceType()` utility function
   - Updated `balanceAddition()` function with balance type logic
   - Updated `balanceWithdraw()` function with balance type logic
   - Updated all `balanceAddition()` calls with appropriate operation types

3. **`/backend/src/controllers/admin.controller.js`**
   - Updated recharge refund transaction to include `balance_type = 'credit'`

## Database Schema
```sql
-- Column already exists in table:
ALTER TABLE bal_transactions 
ADD COLUMN balance_type ENUM('credit', 'debit', 'transfer', 'withdraw') DEFAULT 'transfer';
```

## Usage Examples

```javascript
// Online payment - transfer
await query.addBalanceTransaction(adminId, userId, amount, originalAmount, status, 
  prevBalance, newBalance, maalikPrevBalance, maalikNewBalance, orderId, 'online', remark, 'transfer');

// Admin adding balance - credit
await query.addBalanceTransaction(adminId, userId, amount, originalAmount, status, 
  prevBalance, newBalance, maalikPrevBalance, maalikNewBalance, orderId, 'offline', remark, 'credit');

// Parent transfer - transfer
await query.addBalanceTransaction(parentId, userId, amount, originalAmount, status, 
  prevBalance, newBalance, maalikPrevBalance, maalikNewBalance, orderId, 'offline', remark, 'transfer');

// Parent withdrawal - withdraw
await query.addBalanceTransaction(parentId, userId, amount, originalAmount, status, 
  prevBalance, newBalance, maalikPrevBalance, maalikNewBalance, orderId, 'offline', remark, 'withdraw');
```