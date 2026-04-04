import { prisma } from '@modcart/db';
import { StorageClient } from '@modcart/core';
import { env } from '@modcart/config';

export async function cleanupOrphanImages() {
  console.log('🧹 Starting nightly orphan image cleanup...');
  
  const storage = new StorageClient({
    endPoint: env.MINIO_ENDPOINT,
    port: env.MINIO_PORT,
    useSSL: env.MINIO_USE_SSL,
    accessKey: env.MINIO_ACCESS_KEY,
    secretKey: env.MINIO_SECRET_KEY,
  });

  try {
    // 1. Get all files from storage
    const allFiles = await storage.listFiles();
    console.log(`📦 Found ${allFiles.length} files in storage`);

    // 2. Get all image URLs from database
    const dbImages = await prisma.productImage.findMany({
      select: { url: true }
    });
    const dbFileNames = new Set(
      dbImages.map(img => img.url.split('/modcart-images/')[1]).filter(Boolean)
    );
    
    // Also check vendor logos/banners if we have them
    const vendors = await prisma.vendorProfile.findMany({
      select: { logo: true, banner: true }
    });
    vendors.forEach(v => {
      if (v.logo) dbFileNames.add(v.logo.split('/modcart-images/')[1]);
      if (v.banner) dbFileNames.add(v.banner.split('/modcart-images/')[1]);
    });

    console.log(`📊 ${dbFileNames.size} files are referenced in database`);

    // 3. Find orphans (files in storage NOT in database)
    let orphanCount = 0;
    for (const file of allFiles) {
      if (!dbFileNames.has(file)) {
        console.log(`🗑️ Deleting orphan: ${file}`);
        await storage.delete(file);
        orphanCount++;
      }
    }

    console.log(`✅ Cleanup complete. Deleted ${orphanCount} orphan files.`);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}
