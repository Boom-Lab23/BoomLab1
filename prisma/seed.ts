import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const hashedPassword = await bcrypt.hash("BoomLab2026!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@boomlab.agency" },
    update: {},
    create: {
      name: "Admin BoomLab",
      email: "admin@boomlab.agency",
      password: hashedPassword,
      role: "ADMIN",
      isActive: true,
    },
  });

  console.log("Admin user created:", admin.email);
  console.log("Password: BoomLab2026!");
  console.log("Login at: https://servico.boomlab.agency/login");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
