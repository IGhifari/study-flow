import { prisma } from '@studyflow/database';
import bcrypt from 'bcryptjs';

async function seedDemo() {
  console.log('Seeding StudyFlow Demo Data (Idempotent & Safe)...');

  const demoEmail = 'demo.student@studyflow.test';
  
  // 1. Check or create demo user
  let user = await prisma.user.findUnique({
    where: { email: demoEmail },
  });

  if (!user) {
    const passwordHash = await bcrypt.hash('DemoPassword123!', 10);
    user = await prisma.user.create({
      data: {
        email: demoEmail,
        name: 'Mahasiswa Demo StudyFlow',
        passwordHash,
        timezone: 'Asia/Jakarta',
      },
    });
    console.log(`Created demo user: ${user.email} (ID: ${user.id})`);
  } else {
    console.log(`Demo user already exists: ${user.email}`);
  }

  // 2. Check or create active semester
  let semester = await prisma.semester.findFirst({
    where: { userId: user.id, isActive: true },
  });

  if (!semester) {
    semester = await prisma.semester.create({
      data: {
        userId: user.id,
        name: 'Semester Ganjil 2026/2027',
        academicYear: '2026/2027',
        isActive: true,
      },
    });
    console.log(`Created demo semester: ${semester.name}`);
  } else {
    console.log(`Demo semester already exists: ${semester.name}`);
  }

  // 3. Check or create demo courses
  const courseData = [
    { name: 'Struktur Data dan Algoritma', code: 'IF2110', lecturer: 'Dr. Ir. Rinaldi, M.T.' },
    { name: 'Sistem Operasi', code: 'IF2220', lecturer: 'Ibu Dr. Nurul, S.T., M.T.' },
    { name: 'Basis Data Lanjutan', code: 'IF3110', lecturer: 'Bapak Aris, Ph.D.' },
  ];

  for (const c of courseData) {
    let course = await prisma.course.findFirst({
      where: { userId: user.id, semesterId: semester.id, code: c.code },
    });
    if (!course) {
      course = await prisma.course.create({
        data: {
          userId: user.id,
          semesterId: semester.id,
          name: c.name,
          code: c.code,
          lecturer: c.lecturer,
        },
      });
      console.log(`Created course: ${course.name} (${course.code})`);
    }
  }

  console.log('Demo data seeding completed successfully!');
  await prisma.$disconnect();
}

seedDemo().catch(async (err) => {
  console.error('Error seeding demo data:', err);
  await prisma.$disconnect();
  process.exit(1);
});
