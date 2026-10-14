import readline from 'node:readline';
import { prisma } from '@studyflow/database';

async function main() {
  const args = process.argv.slice(2);
  let email = args.find((arg) => !arg.startsWith('--'));
  const autoConfirm = args.includes('--yes') || args.includes('-y');

  if (!email) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    email = await new Promise<string>((resolve) => {
      rl.question('Masukkan email akun yang ingin dipromosikan menjadi ADMIN: ', (ans) => {
        rl.close();
        resolve(ans.trim());
      });
    });
  }

  if (!email) {
    console.error('Error: Email akun tidak boleh kosong.');
    process.exit(1);
  }

  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      passwordHash: true,
      createdAt: true,
    },
  });

  if (!user) {
    console.error(`Error: Pengguna dengan email "${normalizedEmail}" tidak ditemukan.`);
    process.exit(1);
  }

  console.log('\n--- TARGET AKUN ---');
  console.log(`ID:           ${user.id}`);
  console.log(`Nama:         ${user.name}`);
  console.log(`Email:        ${user.email}`);
  console.log(`Peran saat ini: ${user.role}`);
  console.log(`Punya Password: ${user.passwordHash ? 'Ya' : 'Tidak (Google/OAuth only)'}`);
  console.log(`Terdaftar:    ${user.createdAt.toISOString()}`);
  console.log('-------------------\n');

  if (!user.passwordHash) {
    console.warn(
      'PERINGATAN: Akun ini tidak memiliki kata sandi lokal (mungkin Google OAuth only).\n' +
        'Login administrator pada tahap ini mewajibkan akun memiliki kata sandi.\n'
    );
  }

  if (user.role === 'ADMIN') {
    console.log(`Akun "${user.email}" sudah berstatus ADMIN.`);
    process.exit(0);
  }

  if (!autoConfirm) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question('Ketik "PROMOSIKAN" untuk mengonfirmasi promosi akun ini menjadi ADMIN: ', (ans) => {
        rl.close();
        resolve(ans.trim());
      });
    });

    if (answer !== 'PROMOSIKAN') {
      console.log('Operasi dibatalkan. Tidak ada perubahan yang dilakukan pada database.');
      process.exit(0);
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role: 'ADMIN' },
  });

  console.log(`\nBERHASIL! Akun "${user.email}" telah dipromosikan menjadi ADMIN.\n`);
}

main()
  .catch((err) => {
    console.error('Terjadi kesalahan:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
