/**
 * Popula BillingConfig (preço/crédito) e catálogo Plan (Free, Pro, Plus, Ultra).
 * Rode após `prisma db push` ou migrate: `npm run seed:credits`
 */
import "dotenv/config"
import { prisma } from "../lib/prisma.js"

const plans = [
    {
        slug: "free",
        name: "Free",
        monthlyCredits: 20,
        priceMonthlyCents: 0,
        sortOrder: 0,
    },
    {
        slug: "pro",
        name: "Pro",
        monthlyCredits: 100,
        priceMonthlyCents: 990,
        sortOrder: 1,
    },
    {
        slug: "plus",
        name: "Plus",
        monthlyCredits: 200,
        priceMonthlyCents: 2000,
        sortOrder: 2,
    },
    {
        slug: "ultra",
        name: "Ultra",
        monthlyCredits: 300,
        priceMonthlyCents: 3000,
        sortOrder: 3,
    },
]

async function main() {
    await prisma.billingConfig.upsert({
        where: { id: "default" },
        create: {
            id: "default",
            creditUnitCents: 10,
        },
        update: {
            creditUnitCents: 10,
        },
    })

    for (const p of plans) {
        await prisma.plan.upsert({
            where: { slug: p.slug },
            create: { ...p, active: true },
            update: {
                name: p.name,
                monthlyCredits: p.monthlyCredits,
                priceMonthlyCents: p.priceMonthlyCents,
                sortOrder: p.sortOrder,
                active: true,
            },
        })
    }

    console.log("TeachAI Credits: BillingConfig +", plans.length, "planos OK.")
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
