"""Print visible Android UI labels/bounds without dumping password fields."""
import subprocess
import xml.etree.ElementTree as ET

subprocess.run(['adb', 'shell', 'uiautomator', 'dump', '/sdcard/sunha-uat.xml'], check=True, stdout=subprocess.DEVNULL)
xml = subprocess.check_output(['adb', 'shell', 'cat', '/sdcard/sunha-uat.xml'])
for node in ET.fromstring(xml).iter('node'):
    if node.get('password') == 'true':
        print('PASSWORD FIELD', node.get('bounds'))
    elif node.get('text') or node.get('content-desc') or node.get('class') == 'android.widget.EditText':
        print(node.get('class'), repr(node.get('text') or node.get('content-desc')), node.get('bounds'))
