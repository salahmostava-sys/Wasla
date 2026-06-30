import requests
import json

project_key = "salahmostava-sys_MuhimmatAltawseel"
token = "1c1326ba5422ef5e3fc3f56c4de26c5fca92cd47"
url = f"https://sonarcloud.io/api/issues/search?componentKeys={project_key}&resolved=false&ps=500"

response = requests.get(url, auth=(token, ''))

if response.status_code == 200:
    issues = response.json().get("issues", [])
    
    with open("sonar_issues.json", "w", encoding="utf-8") as f:
        json.dump(issues, f, ensure_ascii=False, indent=4)
        
    print(f"تم سحب {len(issues)} مشكلة بنجاح!")
else:
    print("حدث خطأ في الاتصال، كود الخطأ:", response.status_code)
    print("الرسالة:", response.text)
