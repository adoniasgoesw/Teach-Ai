import Button from "../buttons/Button"

export default function StudioPanel() {
    return (
        <div className="bg-white w-1/3 rounded-2xl">
            <div className="border-b border-gray-200 p-4">
                <p>Studio</p>
            </div>

            <div className="grid grid-cols-1 gap-2 p-4">
                <Button text={"Content"} size="md" variant="outline" />
            </div>
        </div>
    )
}

