async function main() {
  console.log("🌱 Seeding data...");

  // ✅ Check user trước khi create
  let user = await prisma.user.findUnique({
    where: { email: "admin@gmail.com" },
  });

  if (!user) {
    const hashedPassword = await bcrypt.hash("123456", 10);
    user = await prisma.user.create({
      data: {
        name: "Admin User",
        role: "admin",
        email: "admin@gmail.com",
        password: hashedPassword,
        contractType: "monthly",
        address: "123 Main Street",
        phone: "0123456789",
      },
    });
  }

  // ✅ Check categories
  const existingCategories = await prisma.category.findMany();
  let categories: Category[] = existingCategories;

  if (categories.length === 0) {
    for (let i = 1; i <= 4; i++) {
      const category = await prisma.category.create({
        data: { name: `Category ${i}`, sortOrder: i },
      });
      categories.push(category);
    }
  }

  // ✅ Check menu items
  const existingItems = await prisma.menuItem.count();
  if (existingItems === 0) {
    for (let i = 0; i < DISH_NAMES.length; i++) {
      const category = categories[Math.floor(Math.random() * categories.length)];
      await prisma.menuItem.create({
        data: {
          name: DISH_NAMES[i],
          description: `Món ${DISH_NAMES[i]} thơm ngon, chế biến trong ngày`,
          price: randomPrice(),
          available: true,
          user: { connect: { id: user.id } },
          category: { connect: { id: category.id } },
          images: {
            create: [
              { image: `anh(${i + 1}).jpg` },
              { image: `anh(${i + 2}).jpg` },
              { image: `anh(${i + 3}).jpg` },
            ],
          },
          options: {
            create: Array.from({ length: Math.floor(Math.random() * 3) + 1 }).map((_, idx) => ({
              name: `Option ${idx + 1}`,
              required: randomBool(),
            })),
          },
        },
      });
    }
  }

  // ✅ Check tables
  const existingTables = await prisma.table.count();
  if (existingTables === 0) {
    for (let i = 1; i <= 10; i++) {
      await prisma.table.create({
        data: {
          name: `Table ${i}`,
          qrCode: `QR-${i}-${Math.floor(Math.random() * 1000)}`,
          status: "empty",
        },
      });
    }
  }

  console.log("✅ Seed data created successfully!");
}