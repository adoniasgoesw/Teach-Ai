import CardCourse from "../cards/CardCourse"
import { useCourses } from "../../hooks/useCourses"

export default function ListCourses({ user }) {
  const { courses, loading, error } = useCourses(user.id)

  const hasCourses = Array.isArray(courses) && courses.length > 0

  if (loading) {
    return <div className="flex flex-col items-center justify-center h-full w-full">
      <p className="text-sm text-gray-600">Carregando cursos...</p>
    </div>

  }

  if (error) {
    return <p className="text-sm text-red-500">{error}</p>
  }

  if (!hasCourses) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full">
        <h2 className="text-2xl font-light ">Welcome, {user.name}</h2>
        <p className="text-sm text-gray-700">You can add your first course here</p>
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <div className="grid grid-cols-5 gap-4 ">
        {courses.map((course) => (
          <CardCourse
            key={course.id}
            name={course.name}
            createdAt={course.createdAt}
            sourcesCount={course?._count?.sources}
            icon={course.icon}
            course={course}
          />
        ))}
      </div>
    </div>
  )
}

