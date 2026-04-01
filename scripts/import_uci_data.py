import csv
import json
import random
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
INPUT_FILES = [
    BASE_DIR / 'student+performance' / 'student' / 'student-mat.csv',
    BASE_DIR / 'student+performance' / 'student' / 'student-por.csv'
]
OUTPUT_FILE = BASE_DIR / 'app' / 'mock-data.json'

PARENT_FIRST_NAMES = ['Aditi','Bhanu','Chitra','Deepak','Esha','Farhan','Geeta','Himanshu','Indira','Jatin',
               'Kavya','Lakshmi','Madhav','Nisha','Omkar','Preeti','Quinn','Ramesh','Sita','Tara',
               'Uday','Vikram','Waseem','Xena','Yamini','Zafar','Akash','Bela','Chandan','Diya',
               'Eklavya','Firoz','Gita','Harish','Isha','Jaya','Kabir','Lata','Mahesh','Neha',
               'Omi','Pooja','Rohan','Samar','Trisha','Usha','Varun','Yash','Zoya','Ramya']
PARENT_LAST_NAMES = ['Kumar','Sharma','Patel','Rao','Singh','Joshi','Ghosh','Nair','Menon','Chaudhary','Khan','Shah','Gupta']


def normalize_name(name_raw):
    # remove quotes and whitespace
    return name_raw.strip().strip('"')


def create_parent_contact():
    return {
        'parentName': f"{random.choice(PARENT_FIRST_NAMES)} {random.choice(PARENT_LAST_NAMES)}",
        'parentPhone': f"+91{random.randint(600_000_0000, 999_999_9999)}"
    }


def read_students():
    records = []
    for file in INPUT_FILES:
        if not file.exists():
            raise FileNotFoundError(f"Input file not found: {file}")

        with file.open(newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f, delimiter=';', quotechar='"')
            for raw_idx, row in enumerate(reader, start=1):
                if len(records) >= 649:
                    return records

                try:
                    absences = int(row.get('absences', 0))
                    traveltime = int(row.get('traveltime', 0))
                except (ValueError, TypeError):
                    print(f"Skipping row due to invalid numeric values: {row}")
                    continue

                school = normalize_name(row.get('school', 'UCI'))
                sex = normalize_name(row.get('sex', 'U'))
                age = normalize_name(row.get('age', '0'))

                name = f"{school}-{sex}-{age}-{len(records)+1:04d}"

                parent_contact = create_parent_contact()

                g3 = 0
                try:
                    g3 = int(row.get('G3', 0))
                except (ValueError, TypeError):
                    g3 = 0

                records.append({
                    'id': f"UCI-{len(records)+1:04d}",
                    'name': name,
                    'parentName': parent_contact['parentName'],
                    'parentPhone': parent_contact['parentPhone'],
                    'absences': absences,
                    'traveltime': traveltime,
                    'G3': g3,
                    'status': 'unknown'
                })

    return records


def write_output(records):
    with OUTPUT_FILE.open('w', encoding='utf-8') as f:
        json.dump(records, f, indent=2)


if __name__ == '__main__':
    students = read_students()
    if len(students) < 649:
        print(f"Warning: only generated {len(students)} records (expected >=649)")
    else:
        print(f"Generated {len(students)} records")
    write_output(students)
    print(f"Wrote output to {OUTPUT_FILE}")
