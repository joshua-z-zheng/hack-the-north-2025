"use client";

import { useState } from "react";
import { NumberInput } from "@/components/number-input";
import { Button } from "@/components/ui/button";

interface Course {
  code: string;
  grade?: number | null;
  past?: boolean;
  contract?: string;
}

interface User {
  email: string;
  courses: Course[];
}

interface Props {
  user: User;
}

export default function AdminUserView({ user }: Props) {
  const [addCourseCode, setAddCourseCode] = useState("");
  const [courses, setCourses] = useState(user.courses);
  const [pendingGrades, setPendingGrades] = useState<{ [courseCode: string]: number }>({});
  const [isSubmitting, setIsSubmitting] = useState<{ [courseCode: string]: boolean }>({});

  const handleGradeChange = (courseCode: string, grade: number | undefined) => {
    setPendingGrades(prev => ({
      ...prev,
      [courseCode]: grade || 0
    }));
  };

  const handleConfirmGrade = async (courseCode: string) => {
    const grade = pendingGrades[courseCode];
    if (grade === undefined || grade === null) return;

    setIsSubmitting(prev => ({ ...prev, [courseCode]: true }));

    try {
      const response = await fetch('/api/resolve-course', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          courseCode: courseCode,
          grade: grade
        }),
      });

      if (response.ok) {
        // Update the local state to reflect the change
        setCourses(prev => prev.map(course =>
          course.code === courseCode
            ? { ...course, grade: grade, past: true }
            : course
        ));

        // Remove from pending grades
        setPendingGrades(prev => {
          const updated = { ...prev };
          delete updated[courseCode];
          return updated;
        });
      } else {
        console.error('Failed to resolve course');
        // You might want to show an error message to the user here
      }
    } catch (error) {
      console.error('Error resolving course:', error);
      // You might want to show an error message to the user here
    } finally {
      setIsSubmitting(prev => ({ ...prev, [courseCode]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 md:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2 leading-tight">{user.email}</h1>
          <p className="text-lg text-muted-foreground leading-relaxed">Student profile.</p>
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2 leading-snug">Add a Course</h1>
          <div className="mb-8 max-w-md p-6 bg-white rounded-2xl shadow-md border border-gray-200 flex gap-3">
            <input 
              type="text" placeholder="Course Code" onChange={function(e) {setAddCourseCode(e.target.value)}}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition"
            />
            <button 
              type="submit"
              className="px-5 py-2 bg-blue-600 text-white font-medium rounded-lg shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 transition"
              onClick={async function() {
                const res = await fetch("/api/admin/enroll-course", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    id: user.email,
                    courseCode: addCourseCode
                  })
                })
                console.log(res);
              }}
            >
              Enroll
            </button>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2 leading-snug">Courses</h1>
          {courses.map((course, i) => (
            <div
              key={i}
              className="block max-w-md p-6 bg-white rounded-2xl shadow-lg border border-gray-200 hover:shadow-xl transition-shadow mb-4"
            >
              <h2 className="text-xl font-semibold text-gray-800 mb-2">{course.code}</h2>

              <dl className="space-y-2 text-gray-700">
                <div className="flex justify-between items-center">
                  <dt className="font-medium">Current Grade:</dt>
                  {course.grade !== null && course.grade !== undefined ? (
                    <dd className="font-semibold text-blue-600">{course.grade}%</dd>
                  ) : (
                    <div className="flex items-center gap-2">
                      <NumberInput
                        placeholder="Enter grade"
                        min={0}
                        max={100}
                        value={pendingGrades[course.code] || undefined}
                        onValueChange={(value) => handleGradeChange(course.code, value)}
                        className="w-24"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleConfirmGrade(course.code)}
                        disabled={
                          pendingGrades[course.code] === undefined ||
                          pendingGrades[course.code] === null ||
                          isSubmitting[course.code]
                        }
                      >
                        {isSubmitting[course.code] ? "Saving..." : "Confirm"}
                      </Button>
                    </div>
                  )}
                </div>
              </dl>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
