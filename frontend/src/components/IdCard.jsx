import React from 'react';

export default function IdCard({ student, onBack }) {
  if (!student) return null;

  return (
    <>
      <div className="idcard-wrapper">
        <div className="idcard" id="id-card">
          <div className="idcard-top">
            <div className="idcard-logo left">
              <div className="logo-box">
                <img
                  src="/logo.png"
                  alt="NOID Logo"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/photos/NOID.jpg';
                  }}
                />
              </div>
            </div>
            <div className="idcard-title">
              <h1>ST. JOHN COLLEGE</h1>
              <h2>OF ENGINEERING &amp; MANAGEMENT</h2>
              <p>(AUTONOMOUS)</p>
              <small>
                St. John Technical and Educational Campus, Vevoor, Manor Road, Palghar (E), Dist. Palghar - 401404, Maharashtra
              </small>
            </div>
            <div className="idcard-logo right">
              <div className="logo-box">
                <img
                  src="/aldel.jpg"
                  alt="ALDEL EDUCATION TRUST"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/photos/aldel.jpg';
                  }}
                />
              </div>
            </div>
          </div>

          <div className="idcard-banner">STUDENT</div>

          <div className="idcard-body">
            <div className="photo">
              <img
                src={student.photo_url || '/photos/Shamitha.jpg'}
                alt={student.name}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/photos/Shamitha.jpg';
                }}
              />
            </div>
            <div className="details">
              <div className="name">{(student.name || '').toUpperCase()}</div>
              <div className="branch">{(student.department || '').toUpperCase()}</div>
              <div className="row">
                <span>PID NO.</span>
                <b>{student.pid}</b>
              </div>
              <div className="row">
                <span>Course</span>
                <b>{student.course}</b>
              </div>
              <div className="row">
                <span>Year</span>
                <b>SE</b>
              </div>
              <div className="row">
                <span>DOB</span>
                <b>{student.dob || '-'}</b>
              </div>
            </div>
          </div>

          <div className="idcard-bottom"></div>
        </div>
      </div>

      <div className="back-link">
        <a
          href="#back"
          onClick={(e) => {
            e.preventDefault();
            onBack();
          }}
        >
          Search another PID
        </a>
      </div>
    </>
  );
}
