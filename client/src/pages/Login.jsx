import Button from '../components/buttons/Button'
import { useNavigate } from 'react-router-dom'
import FormLogin from '../components/forms/FormLogin'
import FormRegister from '../components/forms/FormRegister'
import { use, useState } from 'react'
import { ArrowLeftIcon } from 'lucide-react'

export default function LoginPage() {
    const navigate = useNavigate()

    

    const [showFormRegister, setShowFormRegister] = useState(false)
    const [showFormLogin, setShowFormLogin] = useState(true)

    function handleShowFormRegister() {
        setShowFormLogin(false)
        setShowFormRegister(true)
    }

    function handleShowFormLogin() {
        setShowFormLogin(true)
        setShowFormRegister(false)
    }

    return (
        <section className='flex flex-col px-5 md:px-10 lg:px-20 py-10 h-screen'>
            <div>
                <Button icon={<ArrowLeftIcon />} onClick={() => navigate('/')} variant="ghost" />
            </div>

            <div className='w-full h-full flex items-center justify-center  '>
                {
                    showFormLogin && (
                        <FormLogin  onCick={handleShowFormRegister}/>
                    )
                }

                {
                    showFormRegister && (
                        <FormRegister onCick={handleShowFormLogin} />
                    )
                }
            </div>
        </section>
    )
}