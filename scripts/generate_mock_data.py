import json, random

first_names = ['Aditi','Bhanu','Chitra','Deepak','Esha','Farhan','Geeta','Himanshu','Indira','Jatin',
               'Kavya','Lakshmi','Madhav','Nisha','Omkar','Preeti','Quinn','Ramesh','Sita','Tara',
               'Uday','Vikram','Waseem','Xena','Yamini','Zafar','Akash','Bela','Chandan','Diya',
               'Eklavya','Firoz','Gita','Harish','Isha','Jaya','Kabir','Lata','Mahesh','Neha',
               'Omi','Pooja','Rohan','Samar','Trisha','Usha','Varun','Yash','Zoya','Ramya']

last_names = ['Kumar','Sharma','Patel','Rao','Singh','Joshi','Ghosh','Nair','Menon','Chaudhary','Khan','Shah','Gupta']

record = []
for i in range(1, 51):
    name = f"{random.choice(first_names)} {random.choice(last_names)}"
    parent_name = f"{random.choice(first_names)} {random.choice(last_names)}"
    parent_phone = f"+91{random.randint(6000000000,9999999999)}"
    absences = random.randint(0, 19)
    traveltime = random.randint(1, 4)
    record.append({
        'id': f"RURAL-{i:03d}",
        'name': name,
        'parentName': parent_name,
        'parentPhone': parent_phone,
        'absences': absences,
        'traveltime': traveltime,
        'status': 'unknown'
    })

with open('app/mock-data.json', 'w') as f:
    json.dump(record, f, indent=2)

# risk model from absences-to-risk mapping
risk_map = []
for a in range(0, 21):
    if a <= 3: risk = 5
    elif a <= 7: risk = 19
    elif a <= 10: risk = 45
    elif a <= 15: risk = 70
    else: risk = 90
    risk_map.append({'absences': a, 'risk': risk})

with open('app/risk-data.json', 'w') as f:
    json.dump(risk_map, f, indent=2)

print('mock-data.json + risk-data.json generated')
