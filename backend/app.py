import os
import logging
from typing import Dict, Optional
import mysql.connector
from mysql.connector import errorcode
from flask import Flask, g, render_template, request, url_for

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

APP_NAME = "NOID"
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
STATIC_DIR = os.path.join(FRONTEND_DIR, "static")
TEMPLATES_DIR = os.path.join(FRONTEND_DIR, "templates")

# MySQL credentials (you can set env vars or fallback to defaults)
MYSQL_CONFIG = {
    "host": os.getenv("MYSQL_HOST", "localhost"),
    "user": os.getenv("MYSQL_USER", "root"),
    "password": os.getenv("MYSQL_PASSWORD", "pooja@2006"),
    "database": os.getenv("MYSQL_DATABASE", "noid_db"),
    "port": int(os.getenv("MYSQL_PORT", "3306")),
}

# Seed dataset (available for both MySQL seeding and fallback demo mode)
SEED_STUDENTS = [
    ('EU1244049', 'Sanskar Agre', 'B.Tech', 'Information Technology', '2006-08-01', 'sanskar@example.com', '9000000001', 'sanskar.jpg'),
    ('EU1244010', 'Bhargavi Ahire', 'B.Tech', 'Information Technology', '2005-11-24', 'bhargavi@example.com', '9000000002', 'bhargavi.jpg'),
    ('EU1244054', 'Janiv Arekar', 'B.Tech', 'Information Technology', '2006-04-21', 'janiv@example.com', '9000000003', 'jain.jpg'),
    ('EU1244017', 'Saanj Bari', 'B.Tech', 'Information Technology', '2007-08-20', 'saanj@example.com', '9000000004', 'Saanj.jpg'),
    ('EU1244052', 'Ronit Bhanushali', 'B.Tech', 'Information Technology', '2006-06-08', 'ronit@example.com', '9000000005', 'ronit.jpg'),
    ('EU1244016', 'Mansvi Bhatre', 'B.Tech', 'Information Technology', '2005-12-21', 'mansvi@example.com', '9000000006', 'mansi.jpg'),
    ('EU1244057', 'Sahas Bochare', 'B.Tech', 'Information Technology', '2007-01-24', 'sahas@example.com', '9000000007', 'Sahas.jpg'),
    ('EU1244022', 'Harsh Chaudhary', 'B.Tech', 'Information Technology', '2006-06-28', 'harsh@example.com', '9000000008', 'harsh.jpg'),
    ('EU1244024', 'Abhijeet Chauhan', 'B.Tech', 'Information Technology', '2006-06-29', 'abhijeet@example.com', '9000000009', 'abhijeet.jpg'),
    ('EU1244025', 'Hriday DasGupta', 'B.Tech', 'Information Technology', '2006-11-11', 'hriday@example.com', '9000000010', 'kiday.jpg'),
    ('EU1244012', 'Pranali Dhodi', 'B.Tech', 'Information Technology', '2008-07-23', 'pranali@example.com', '9000000011', 'pranali.jpg'),
    ('EU1244035', 'Himanshu Dubey', 'B.Tech', 'Information Technology', '2006-05-09', 'himanshu@example.com', '9000000012', 'himanshu.jpg'),
    ('EU1244044', 'Diksha Gharat', 'B.Tech', 'Information Technology', '2006-06-20', 'diksha@example.com', '9000000013', 'Diksha.jpg'),
    ('EU1244001', 'Manaswi Gharat', 'B.Tech', 'Information Technology', '2006-11-14', 'manaswi@example.com', '9000000014', 'Manasvi.jpg'),
    ('EU1244055', 'Devayani Jadhav', 'B.Tech', 'Information Technology', '2006-07-03', 'devayani@example.com', '9000000015', 'Devyani.jpg'),
    ('EU1244063', 'Vidhi Jasoliya', 'B.Tech', 'Information Technology', '2006-10-11', 'vidhi@example.com', '9000000016', 'Vidhi.jpg'),
    ('EU1244047', 'Aastha Joshi', 'B.Tech', 'Information Technology', '2006-05-24', 'aastha@example.com', '9000000017', 'Astha.jpg'),
    ('EU1244060', 'Rahul Karankale', 'B.Tech', 'Information Technology', '2005-11-30', 'rahul@example.com', '9000000018', 'rahul.jpg'),
    ('EU1244036', 'Sairaj Khade', 'B.Tech', 'Information Technology', '2006-12-21', 'siraj@example.com', '9000000019', 'Sairaj.jpg'),
    ('EU1244033', 'Shubham Kini', 'B.Tech', 'Information Technology', '2007-02-10', 'shubham@example.com', '9000000020', 'shubham.jpg'),
    ('EU1244056', 'Chetan Lokare', 'B.Tech', 'Information Technology', '2006-07-18', 'chetan@example.com', '9000000021', 'chetan.jpg'),
    ('EU1244018', 'Riz Lopes', 'B.Tech', 'Information Technology', '2005-09-26', 'riz@example.com', '9000000022', 'Riz.jpg'),
    ('EU1244020', 'Vedika Mhatre', 'B.Tech', 'Information Technology', '2006-10-09', 'vedika@example.com', '9000000023', 'vedika.jpg'),
    ('EU1244028', 'Mayank Mishra', 'B.Tech', 'Information Technology', '2007-03-22', 'mayank@example.com', '9000000024', 'mayank.jpg'),
    ('EU1244050', 'Jay More', 'B.Tech', 'Information Technology', '2006-12-09', 'jay@example.com', '9000000025', 'jay.jpg'),
    ('EU1244019', 'Parth More', 'B.Tech', 'Information Technology', '2007-02-06', 'parth@example.com', '9000000026', 'parth.jpg'),
    ('EU1244040', 'Riya Naik', 'B.Tech', 'Information Technology', '2006-12-16', 'riya@example.com', '9000000027', 'riya.jpg'),
    ('EU1244041', 'Prem Nayi', 'B.Tech', 'Information Technology', '2005-10-03', 'prem@example.com', '9000000028', 'Prem.jpg'),
    ('EU1244004', 'Shamitha Palai', 'B.Tech', 'Information Technology', '2006-02-24', 'shamita@example.com', '9000000029', 'Shamitha.jpg'),
    ('EU1244045', 'Miloni Pamale', 'B.Tech', 'Information Technology', '2005-11-24', 'miloni@example.com', '9000000030', 'Miloni.jpg'),
    ('EU1244026', 'Vishal Pandey', 'B.Tech', 'Information Technology', '2005-08-06', 'vishal@example.com', '9000000031', 'Vishal.jpg'),
    ('EU1244037', 'Neej Patel', 'B.Tech', 'Information Technology', '2006-09-27', 'neel@example.com', '9000000032', 'Neej.jpg'),
    ('EU1244092', 'Gayatri Patil', 'B.Tech', 'Information Technology', '2006-02-26', 'gayatri@example.com', '9000000033', 'Gayatri.jpg'),
    ('EU1244013', 'Pranjal Patil', 'B.Tech', 'Information Technology', '2006-04-18', 'pranjal@example.com', '9000000034', 'pranjal.jpg'),
    ('EU1244008', 'Sahil Patil', 'B.Tech', 'Information Technology', '2006-03-29', 'sahil@example.com', '9000000035', 'sahil.jpg'),
    ('EU1244006', 'Shamwel Patil', 'B.Tech', 'Information Technology', '2005-11-19', 'shamwel@example.com', '9000000036', 'shamwel.jpg'),
    ('EU1244009', 'Siddhi Patil', 'B.Tech', 'Information Technology', '2006-05-15', 'siddhi@example.com', '9000000037', 'Siddhi.jpg'),
    ('EU1244038', 'Faizan Raeen', 'B.Tech', 'Information Technology', '2006-06-23', 'faizan@example.com', '9000000038', 'faizan.jpg'),
    ('EU1244005', 'Harsh Raut', 'B.Tech', 'Information Technology', '2006-06-22', 'harsh@example.com', '9000000039', 'harsh.jpg'),
    ('EU1244030', 'Komal Rawat', 'B.Tech', 'Information Technology', '2006-06-21', 'komal@example.com', '9000000040', 'komal.jpg'),
    ('EU1244003', 'Pooja Sahu', 'B.Tech', 'Information Technology', '2006-10-11', 'pooja@example.com', '9000000041', 'Pooja.jpg'),
    ('EU1244043', 'Om Salvi', 'B.Tech', 'Information Technology', '2005-10-10', 'om@example.com', '9000000042', 'om.jpg'),
    ('EU1244007', 'Bhumi Sankhe', 'B.Tech', 'Information Technology', '2006-07-22', 'bhumi@example.com', '9000000043', 'Bhumi.jpeg'),
    ('EU1244002', 'Parth Satve', 'B.Tech', 'Information Technology', '2005-03-16', 'parthsatre@example.com', '9000000044', 'parthsatre.jpg'),
    ('EU1244014', 'Parth Save', 'B.Tech', 'Information Technology', '2005-08-09', 'parthsave@example.com', '9000000045', 'parthsave.jpg'),
    ('EU1244048', 'Dhwani Savani', 'B.Tech', 'Information Technology', '2006-02-14', 'dhwani@example.com', '9000000046', 'dhruvani.jpg'),
    ('EU1244059', 'Meraj Shaikh', 'B.Tech', 'Information Technology', '2006-03-02', 'meraj@example.com', '9000000047', 'meroj.jpg'),
    ('EU1244015', 'Parveen Shaikh', 'B.Tech', 'Information Technology', '2006-10-20', 'parveen@example.com', '9000000048', 'Parveen.jpg'),
    ('EU1244029', 'Ayushi Shukla', 'B.Tech', 'Information Technology', '2006-08-09', 'ayushi@example.com', '9000000049', 'Aayushi.jpg'),
    ('EU1244034', 'Naman Singh', 'B.Tech', 'Information Technology', '2007-05-14', 'naman@example.com', '9000000050', 'Naman.jpg'),
    ('EU1244046', 'Nistha Singh', 'B.Tech', 'Information Technology', '2006-01-21', 'nistha@example.com', '9000000051', 'Nistha.jpg'),
    ('EU1244062', 'Rupesh Singh', 'B.Tech', 'Information Technology', '2006-09-25', 'rupesh@example.com', '9000000052', 'rupesh.jpg'),
    ('EU1244051', 'Vidhisha Sonar', 'B.Tech', 'Information Technology', '2006-05-28', 'vidhisha@example.com', '9000000053', 'Vidhisha.jpeg'),
    ('EU1244031', 'Kapil Sonawane', 'B.Tech', 'Information Technology', '2006-11-08', 'kapil@example.com', '9000000054', 'kapil.jpg'),
    ('EU1244061', 'Mrunal Tamore', 'B.Tech', 'Information Technology', '2006-05-08', 'mrunal@example.com', '9000000055', 'mrunal.jpg'),
    ('EU1244042', 'Harsh Tawade', 'B.Tech', 'Information Technology', '2006-10-15', 'harsh@example.com', '9000000056', 'harsh.jpg'),
    ('EU1244058', 'Druv Vaidya', 'B.Tech', 'Information Technology', '2006-12-12', 'druv@example.com', '9000000057', 'druv.jpg'),
    ('EU1244032', 'Shreyas Yadav', 'B.Tech', 'Information Technology', '2005-10-03', 'shreyas@example.com', '9000000058', 'shreyas.jpg'),
    ('EU1244027', 'Aditya Yadav', 'B.Tech', 'Information Technology', '2005-01-13', 'aditya@example.com', '9000000059', 'Aditya.jpg'),
    ('EU1244021', 'Shweta Yadav', 'B.Tech', 'Information Technology', '2007-09-16', 'shweta@example.com', '9000000060', 'sheweta.jpg'),
    ('EU1244064', 'Soham Yesara', 'B.Tech', 'Information Technology', '2006-07-28', 'soham@example.com', '9000000061', 'soham.jpg'),
    ('EU1224054', 'Krishna Pol', 'B.Tech', 'Information Technology', '2004-09-06', 'krishna@example.com', '9000000062', 'krishna.jpg'),
]

# Track database initialization status
_DB_ATTEMPTED = False


def create_app() -> Flask:
    app = Flask(__name__, static_folder=STATIC_DIR, template_folder=TEMPLATES_DIR)

    @app.before_request
    def _ensure_db_initialized() -> None:
        global _DB_ATTEMPTED
        if not _DB_ATTEMPTED:
            _DB_ATTEMPTED = True
            ensure_database_and_tables()

    @app.teardown_appcontext
    def close_connection(exception: Optional[BaseException]) -> None:
        db = g.pop("_db_conn", None)
        if db is not None:
            try:
                db.close()
            except Exception:
                pass

    @app.route("/")
    def index():
        return render_template("index.html", app_name=APP_NAME)

    @app.route("/generate", methods=["POST"])
    def generate():
        # Accept alphanumeric PID from either 'pid' or 'pidNumber'
        pid_input = (request.form.get("pid") or request.form.get("pidNumber") or "").strip()
        if not pid_input:
            return render_template("id_card.html", app_name=APP_NAME, student=None, error="Invalid PID. Please try again.")

        student = fetch_student_by_pid(pid_input)
        if student is None:
            return render_template("id_card.html", app_name=APP_NAME, student=None, error="Invalid PID. Please try again.")

        return render_template("id_card.html", app_name=APP_NAME, student=student, error=None)

    return app


def get_db_connection():
    if "_db_conn" not in g:
        g._db_conn = mysql.connector.connect(**MYSQL_CONFIG)
    return g._db_conn


def ensure_server_connection():
    """Ensure MySQL server is reachable (without database)."""
    return mysql.connector.connect(
        host=MYSQL_CONFIG["host"],
        user=MYSQL_CONFIG["user"],
        password=MYSQL_CONFIG["password"],
        port=MYSQL_CONFIG["port"],
    )


def ensure_database_and_tables() -> bool:
    try:
        conn = ensure_server_connection()
        cur = conn.cursor()
        cur.execute(f"CREATE DATABASE IF NOT EXISTS `{MYSQL_CONFIG['database']}`")
        cur.close()
        conn.close()

        conn2 = mysql.connector.connect(**MYSQL_CONFIG)
        try:
            cur2 = conn2.cursor()
            cur2.execute(
                """
                CREATE TABLE IF NOT EXISTS students (
                    pid VARCHAR(32) PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    course VARCHAR(50),
                    department VARCHAR(100),
                    email VARCHAR(120),
                    contact VARCHAR(30),
                    photo_url VARCHAR(255)
                )
                """
            )
            try:
                cur2.execute(
                    """
                    SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'students' AND COLUMN_NAME = 'pid'
                    """,
                    (MYSQL_CONFIG["database"],),
                )
                row = cur2.fetchone()
                if not row or str(row[0]).lower() in ("int", "integer", "bigint"):
                    cur2.execute("ALTER TABLE students MODIFY pid VARCHAR(32) NOT NULL")
            except mysql.connector.Error:
                pass

            try:
                cur2.execute(
                    """
                    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'students' AND COLUMN_NAME = 'dob'
                    """,
                    (MYSQL_CONFIG["database"],),
                )
                (has_dob,) = cur2.fetchone() or (0,)
                if int(has_dob) == 0:
                    cur2.execute("ALTER TABLE students ADD COLUMN dob VARCHAR(20) NULL AFTER department")
            except mysql.connector.Error:
                pass

            cur2.execute("SELECT COUNT(*) FROM students")
            (count,) = cur2.fetchone() or (0,)
            if count == 0:
                cur2.executemany(
                    "INSERT INTO students (pid, name, course, department, dob, email, contact, photo_url) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                    SEED_STUDENTS,
                )
            else:
                for row in SEED_STUDENTS:
                    cur2.execute(
                        """
                        INSERT INTO students (pid, name, course, department, dob, email, contact, photo_url)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                        ON DUPLICATE KEY UPDATE
                            name=VALUES(name),
                            course=VALUES(course),
                            department=VALUES(department),
                            dob=VALUES(dob),
                            email=VALUES(email),
                            contact=VALUES(contact),
                            photo_url=VALUES(photo_url)
                        """,
                        row,
                    )
            conn2.commit()
            logger.info("Database initialized and synchronized with MySQL.")
            return True
        finally:
            conn2.close()
    except Exception as err:
        logger.warning(f"MySQL connection unavailable ({err}). Running with in-memory dataset fallback.")
        return False


def fetch_student_by_pid(pid: str) -> Optional[Dict[str, str]]:
    # 1. Try MySQL if available
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute(
            "SELECT pid, name, course, department, dob, email, contact, photo_url FROM students WHERE pid = %s",
            (pid,),
        )
        row = cur.fetchone()
        cur.close()
        if row is not None:
            result = {k: str(v) if v is not None else "" for k, v in row.items()}
            return _format_student_result(result)
    except Exception as err:
        logger.debug(f"MySQL query failed ({err}); searching fallback dataset.")

    # 2. Fallback in-memory lookup
    pid_clean = pid.strip().upper()
    for item in SEED_STUDENTS:
        if item[0].upper() == pid_clean:
            result = {
                "pid": item[0],
                "name": item[1],
                "course": item[2],
                "department": item[3],
                "dob": item[4],
                "email": item[5],
                "contact": item[6],
                "photo_url": item[7],
            }
            return _format_student_result(result)

    return None


def _format_student_result(result: Dict[str, str]) -> Dict[str, str]:
    photo_value = result.get("photo_url", "")
    if photo_value and not photo_value.startswith("http"):
        filename = photo_value
        if not filename.startswith("photos/"):
            filename = f"photos/{filename}"
        result["photo_url"] = url_for("static", filename=filename)
    return result


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)
