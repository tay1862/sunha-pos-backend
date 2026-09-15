"""Repeatable HTTP assertions against a disposable API on localhost:3002 only.
No credentials are printed. Creates synthetic restaurants; does not delete data.
"""
import json
import os
import urllib.request
import urllib.error
import uuid

if os.environ.get('SUNHA_AUDIT_DISPOSABLE') != 'yes':
    raise SystemExit('Requires SUNHA_AUDIT_DISPOSABLE=yes and disposable API on port 3002')
BASE = 'http://127.0.0.1:3002/v1'

def call(path, body=None, method=None, headers=None, status=200):
    req = urllib.request.Request(BASE + path, data=None if body is None else json.dumps(body).encode(),
        headers={'Content-Type': 'application/json', **(headers or {})},
        method=method or ('POST' if body is not None else 'GET'))
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            actual, raw = response.status, response.read()
    except urllib.error.HTTPError as error:
        actual, raw = error.code, error.read()
    assert actual == status, (path, actual, status, raw.decode()[:300])
    return json.loads(raw)

def signup(name):
    data = call('/auth/signup', {'email': f'uat-{uuid.uuid4()}@example.invalid',
        'password': str(uuid.uuid4()), 'businessName': name, 'country': 'LA'}, status=201)['data']
    return {'Authorization': 'Bearer ' + data['accessToken'],
        'x-employee-session': data['employeeSessionToken'],
        'x-employee-id': data['ownerEmployeeId'], 'x-device-id': data['ownerDeviceId']}

def main():
    call('/health/ready')
    a, b = signup('UAT Restaurant A'), signup('UAT Restaurant B')
    call('/setup/store', {'name': 'ຮ້ານອາຫານ UAT A'}, 'PATCH', a)
    manager = call('/employees', {'name': 'UAT Manager', 'pin': '123456', 'role': 'MANAGER'}, headers=a, status=201)
    call('/catalog/items', headers={k: v for k, v in a.items() if k != 'x-employee-session'}, status=403)
    cashier = call('/employees', {'name': 'UAT Cashier', 'pin': '654321', 'role': 'CASHIER'}, headers=a, status=201)
    call('/employees/verify-pin', {'employeeId': cashier['id'], 'pin': '000000'}, headers=a, status=401)
    verified = call('/employees/verify-pin', {'employeeId': cashier['id'], 'pin': '654321'}, headers=a, status=201)
    cash_headers = {**a, 'x-employee-id': cashier['id'], 'x-employee-session': verified['sessionToken']}
    call('/employees', headers=cash_headers, status=403)
    call('/employees', headers={**cash_headers, 'x-employee-id': a['x-employee-id']}, status=403)
    item = call('/catalog/items', {'name': 'ຂ້າວຜັດ / Fried rice', 'baseUnitName': 'plate', 'trackStock': True,
        'units': [{'name': 'plate', 'multiplierToBase': '1', 'price': {'amount': '25000', 'currency': 'LAK'}}]}, headers=a, status=201)
    call('/inventory/adjustments', {'itemId': item['id'], 'quantityBase': '10', 'reason': 'UAT opening stock',
        'managerEmployeeId': manager['id'], 'managerPin': '123456'}, headers=a, status=201)
    call('/shifts/open', {'openingAmount': '100000'}, headers=a, status=201)
    order = {'clientOrderId': str(uuid.uuid4()), 'lines': [{'itemId': item['id'], 'unitId': item['units'][0]['id'], 'quantity': '2'}],
        'paymentType': 'CASH', 'tenderedAmount': {'amount': '100000', 'currency': 'LAK'}}
    sale = call('/orders/checkout', order, headers=a, status=201)
    assert sale['totalAmount'] == '50000', sale['totalAmount']
    replay = call('/orders/checkout', order, headers=a, status=201)
    assert replay['id'] == sale['id']
    changed = {**order, 'lines': [{**order['lines'][0], 'quantity': '3'}]}
    call('/orders/checkout', changed, headers=a, status=409)
    receipt = call('/receipts/' + sale['receipts'][0]['id'], headers=a)
    assert receipt['order']['totalAmount'] == '50000'
    call('/receipts/' + sale['receipts'][0]['id'], headers=b, status=404)
    call('/orders/checkout', order, headers=b, status=409)
    assert not call('/receipts', headers=b)
    report = call('/reports/sales', headers=a)
    assert report['totalAmount'] == '50000'
    refund = {'orderId': sale['id'], 'managerEmployeeId': manager['id'], 'managerPin': '123456', 'reason': 'UAT customer cancelled'}
    result = call('/refunds', refund, headers=a, status=201)
    repeat = call('/refunds', refund, headers=a, status=201)
    assert result['id'] == repeat['id']
    assert call('/reports/sales', headers=a)['totalAmount'] == '0'
    closed = call('/shifts/close', {'closingAmount': '100000'}, headers=a, status=201)
    assert closed['expectedAmount'] == '100000', closed
    assert str(closed['variance']) == '0', closed
    print('PASS HTTP: signup/settings/stock/open/order/payment/receipt/retry/conflict/tenant isolation/refund/report/close')

if __name__ == '__main__':
    main()
