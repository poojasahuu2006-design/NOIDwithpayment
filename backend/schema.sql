DROP TABLE IF EXISTS students;

CREATE TABLE students (
    pid INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    course TEXT,
    department TEXT,
    email TEXT,
    contact TEXT,
    photo_url TEXT
);

INSERT INTO students (pid, name, course, department, email, contact, photo_url) VALUES
    (101, 'John Doe', 'BCS', 'Computer Science', 'john@example.com', '9876543210', 'static/photos/john.jpg'),
    (102, 'Pooja Sahu', 'BCA', 'Information Technology', 'pooja@example.com', '9876501234', 'static/photos/pooja.jpg'),
    (103, 'Amit Verma', 'BSc', 'Physics', 'amit@example.com', '9876512345', 'static/photos/amit.jpg');

