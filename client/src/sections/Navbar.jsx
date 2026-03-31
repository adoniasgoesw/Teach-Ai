import Button from '../components/buttons/Button'
import { useNavigate } from 'react-router-dom'


export default function Navbar() {

    const navigate = useNavigate()

    return (
        <header className='flex justify-between items-center p-4 w-full px-5 md:px-10 lg:px-20 py-10'>
            <nav className='flex justify-between items-center gap-10 w-full'>
                <div>
                    <h4>teach AI</h4>
                </div>

                <div>
                    <Button variant="primary"
                        text={"Let's Start"}
                        onClick={() => navigate('/login')}
                    />
                </div>
            </nav>
        </header>
    )
}