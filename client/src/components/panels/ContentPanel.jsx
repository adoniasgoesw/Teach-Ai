import Button from "../buttons/Button"
import { FileUp } from "lucide-react"
import CourseContent from "../content/CourseContent"

export default function ContentPanel({
    hasSources,
    course,
    selectedLesson,
    selectedContent,
    onNextLesson,
}) {
    return (
        <div className="bg-white w-1/2  rounded-2xl">
            <div className="border-b border-gray-200 p-4">
                <p>Content</p>
            </div>

            <div className="p-4 flex items-center justify-center h-full w-full">
                {!hasSources && (
                    <div className="flex flex-col items-center justify-center gap-2 text-center">
                        <Button icon={<FileUp />} size="icon" variant="icon" />
                        <p>Adcione uma fonte para o seu curso</p>
                        <Button
                        text={"Fazer o upload de um arquivo"}
                        variant="outline" 
                        size="sm"
                            
                        >
                            <Input:file type="file" />
                        </Button>
                    </div>
                )}

                {hasSources && (
                    <CourseContent
                        course={course}
                        selectedLesson={selectedLesson}
                        selectedContent={selectedContent}
                        onNextLesson={onNextLesson}
                    />
                )}
            </div>
        </div>
    )
}

