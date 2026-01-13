"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

export async function addRedisConfig(formData: FormData) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        throw new Error("Unauthorized");
    }

    const name = formData.get("name") as string;
    const host = formData.get("host") as string;
    const port = parseInt(formData.get("port") as string);
    const password = formData.get("password") as string;
    const db = parseInt(formData.get("db") as string);

    await prisma.redisConfig.create({
        data: {
            name,
            host,
            port,
            password: password || null,
            db,
            userId: session.user.id,
        },
    });

    revalidatePath("/dashboard/redis");
}

export async function deleteRedisConfig(id: string) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        throw new Error("Unauthorized");
    }

    await prisma.redisConfig.delete({
        where: {
            id,
            userId: session.user.id,
        },
    });

    revalidatePath("/dashboard/redis");
}

export async function getRedisConfigs() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return [];
    }

    return await prisma.redisConfig.findMany({
        where: {
            userId: session.user.id,
        },
        orderBy: {
            createdAt: "desc",
        },
    });
}
