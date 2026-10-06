import { redirect } from "next/navigation";
import { ExerciseLibraryManager } from "@/components/mister/exercise-library-manager";
import { getAuthSession } from "@/lib/auth";
import { getCoachCategoryIdsForUser } from "@/lib/attendance";
import { prisma } from "@/lib/prisma";
import { buildExerciseLibraryWhere } from "@/lib/training-session";
import type { Prisma } from "@prisma/client";

export default async function MisterExerciseLibraryPage() {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/mister/libreria-esercizi");
  }
  if (
    session.user.role !== "COACH" &&
    session.user.role !== "ADMIN" &&
    session.user.role !== "YOUTH_DIRECTOR"
  ) {
    redirect("/unauthorized");
  }

  const allowedCategoryIds =
    session.user.role === "COACH"
      ? await getCoachCategoryIdsForUser(session.user.id)
      : (
          await prisma.category.findMany({
            where: { isActive: true },
            select: { id: true },
          })
        ).map((c) => c.id);

  const where = buildExerciseLibraryWhere({
    role: session.user.role,
    userId: session.user.id,
    allowedCategoryIds,
  }) as Prisma.TrainingExerciseWhereInput;

  const [exercises, categories] = await Promise.all([
    prisma.trainingExercise.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      take: 200,
      select: {
        id: true,
        title: true,
        description: true,
        durationMin: true,
        materials: true,
        categoryId: true,
        category: { select: { name: true } },
      },
    }),
    allowedCategoryIds.length === 0
      ? Promise.resolve([])
      : prisma.category.findMany({
          where: { id: { in: allowedCategoryIds } },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
  ]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-blue-50 p-4 md:p-8">
      <div className="mx-auto w-full max-w-[720px]">
        <ExerciseLibraryManager
          initialExercises={exercises.map((ex) => ({
            id: ex.id,
            title: ex.title,
            description: ex.description,
            durationMin: ex.durationMin,
            materials: ex.materials,
            categoryId: ex.categoryId,
            categoryName: ex.category?.name ?? null,
          }))}
          categories={categories}
        />
      </div>
    </main>
  );
}
