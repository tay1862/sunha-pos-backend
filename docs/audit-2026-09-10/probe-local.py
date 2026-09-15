"""Audit reproductions. Creates synthetic data ONLY on dedicated localhost:3002 API.
Start that API against a disposable audit database with email delivery disabled.
Does not print credentials or delete data. This is a diagnostic, not a passing test suite.
"""
import json
import uuid
import urllib.request
import urllib.error
import sqlite3
import os

if os.environ.get('SUNHA_AUDIT_DISPOSABLE') != 'yes':
    raise SystemExit('Set SUNHA_AUDIT_DISPOSABLE=yes only after verifying port 3002 uses a disposable audit database and email delivery is disabled.')

BASE = 'http://127.0.0.1:3002/v1'
headers = {'Content-Type': 'application/json'}

def request(path, body=None, method=None, overrides=None):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else None,
        headers={**headers, **(overrides or {})}, method=method or ('POST' if body is not None else 'GET'))
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.load(error)

def show(label, result):
    print(label, json.dumps(result, ensure_ascii=False))

show('health', request('/health'))
show('ready', request('/health/ready'))
status, signup = request('/auth/signup', {'email': f'audit-{uuid.uuid4()}@example.invalid',
    'password': str(uuid.uuid4()), 'businessName': 'LOCAL AUDIT ONLY', 'country': 'LA'})
assert status == 201, (status, signup)
session = signup['data']
headers.update({'Authorization': 'Bearer ' + session['accessToken'],
    'x-employee-id': session['ownerEmployeeId'], 'x-device-id': session['ownerDeviceId']})
show('signup', {'status': status, 'owner_device_returned': True})
status, item = request('/catalog/items', {'name': 'Audit item', 'baseUnitName': 'unit', 'trackStock': False,
    'units': [{'name': 'unit', 'multiplierToBase': '1', 'price': {'amount': '10000', 'currency': 'LAK'}}]})
assert status == 201, (status, item)
show('create_item', {'status': status})
status, tax = request('/catalog/taxes', {'name': 'TEST 10 percent', 'rateBasisPoints': 1000, 'mode': 'EXCLUSIVE'})
assert status == 201, (status, tax)
order = {'clientOrderId': str(uuid.uuid4()), 'lines': [{'itemId': item['id'], 'unitId': item['units'][0]['id'], 'quantity': '1'}],
    'paymentType': 'CASH', 'tenderedAmount': {'amount': '20000', 'currency': 'LAK'}}
status, sale = request('/orders/checkout', order)
show('sale_without_open_shift', {'status': status, 'total': sale.get('totalAmount'), 'payments': sale.get('payments')})
status, repeated = request('/orders/checkout', order)
show('same_id_retry', {'status': status, 'same_order': repeated.get('id') == sale.get('id')})
status, changed = request('/orders/checkout', {**order, 'lines': [{**order['lines'][0], 'quantity': '2'}]})
show('same_id_changed_payload', {'status': status, 'same_order': changed.get('id') == sale.get('id'), 'total': changed.get('totalAmount')})
status, cashier = request('/employees', {'name': 'Audit cashier', 'pin': '123456', 'role': 'CASHIER'})
assert status == 201, (status, cashier)
show('cashier_manage_employees', request('/employees', overrides={'x-employee-id': cashier['id']})[0])
show('owner_header_without_pin', request('/employees')[0])
show('close_cycle_1_open', request('/shifts/open', {'openingAmount': '1000'})[0])
show('positive_cash_out', request('/shifts/cash-movements', {'amount': '100', 'type': 'CASH_OUT', 'reason': 'audit'})[0])
status, closed = request('/shifts/close', {'closingAmount': '900'})
show('close_cycle_1', {'status': status, 'expected': closed.get('expectedAmount'), 'variance': closed.get('variance')})
show('close_cycle_2_open', request('/shifts/open', {'openingAmount': '0'})[0])
show('close_cycle_2_close', request('/shifts/close', {'closingAmount': '0'}))
request('/catalog/items/' + item['id'], method='DELETE')
status, inactive = request('/orders/checkout', {**order, 'clientOrderId': str(uuid.uuid4())})
show('sell_deactivated_item', {'status': status, 'total': inactive.get('totalAmount')})
status, sales = request('/reports/sales')
show('reports_sales', {'status': status, 'orderCount': sales.get('orderCount'), 'totalAmount': sales.get('totalAmount')})
db = sqlite3.connect(':memory:')
show('sqlite_retry_due_comparison', db.execute("SELECT '2026-09-10T10:00:00.000Z' <= datetime('2026-09-10 11:00:00'), datetime('2026-09-10T10:00:00.000Z') <= datetime('2026-09-10 11:00:00')").fetchone())
