import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const Roles = {
  ADMIN: 'ADMIN',
  LEARNER: 'LEARNER'
} as const;

type RoleValue = (typeof Roles)[keyof typeof Roles];

const IDS = {
  adminUser: '11111111-1111-1111-1111-111111111111',
  learnerUser: '22222222-2222-2222-2222-222222222222',
  studyMaterial: '33333333-3333-3333-3333-333333333333',
  contentChunk: '44444444-4444-4444-4444-444444444444',
  generatedAsset: '55555555-5555-5555-5555-555555555555',
  learningSession: '66666666-6666-6666-6666-666666666666',
  interaction: '77777777-7777-7777-7777-777777777777',
  userFeedback: '88888888-8888-8888-8888-888888888888',
  progressMetric: '99999999-9999-9999-9999-999999999999',
  auditLog: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
};

async function seedRolesAndUsers() {
  const [admin, learner] = await Promise.all([
    prisma.user.upsert({
      where: { email: 'admin@ctoprojects.dev' },
      update: {
        username: 'admin',
        role: Roles.ADMIN as RoleValue,
        isActive: true
      },
      create: {
        id: IDS.adminUser,
        email: 'admin@ctoprojects.dev',
        username: 'admin',
        passwordHash: '$2b$10$R9lNq1Ad3lVhGfULDemoQu4WG5M0f7c8F8aWq8w1i4m4Q8NmXc5dW',
        firstName: 'Platform',
        lastName: 'Admin',
        role: Roles.ADMIN as RoleValue,
        isActive: true
      }
    }),
    prisma.user.upsert({
      where: { email: 'learner@ctoprojects.dev' },
      update: {
        username: 'demo',
        role: Roles.LEARNER as RoleValue,
        isActive: true
      },
      create: {
        id: IDS.learnerUser,
        email: 'learner@ctoprojects.dev',
        username: 'demo',
        passwordHash: '$2b$10$r1Qi9K6p0l1u8D0h.EzLxuE6H9ceJk3QLw2fvt8fV3c5s7pRKY0nO',
        firstName: 'Demo',
        lastName: 'Learner',
        role: Roles.LEARNER as RoleValue,
        preferences: {
          studyMode: 'spaced_repetition',
          locale: 'en-US'
        },
        isActive: true
      }
    })
  ]);

  return { admin, learner };
}

async function seedStudyMaterial(user: { id: string }) {
  return prisma.studyMaterial.upsert({
    where: { id: IDS.studyMaterial },
    update: { status: 'ready' },
    create: {
      id: IDS.studyMaterial,
      userId: user.id,
      title: 'Adaptive Physics Fundamentals',
      description: 'A starter packet for testing ingestion to learning flows.',
      sourceType: 'upload',
      sourceUrl: 'https://example.com/physics.pdf',
      status: 'ready',
      tags: ['physics', 'demo'],
      metadata: {
        originalFilename: 'physics.pdf',
        checksum: 'demo-checksum'
      },
      subjectArea: 'Physics',
      difficultyLevel: 'intermediate',
      contentLength: 4200
    }
  });
}

async function seedContentChunk(studyMaterial: { id: string }) {
  return prisma.contentChunk.upsert({
    where: { id: IDS.contentChunk },
    update: { summary: "Newtonian basics summary" },
    create: {
      id: IDS.contentChunk,
      studyMaterialId: studyMaterial.id,
      chunkOrder: 1,
      content: "Newton's second law states that F = m * a for constant mass systems.",
      chunkType: 'text',
      metadata: {
        language: 'en',
        estimated_read_time_seconds: 45
      },
      wordCount: 24,
      language: 'en',
      summary: "Covers Newton's second law with context.",
      relevanceScore: 0.92
    }
  });
}

async function seedGeneratedAsset(studyMaterial: { id: string }, chunk: { id: string }) {
  return prisma.generatedAsset.upsert({
    where: { id: IDS.generatedAsset },
    update: { status: 'ready' },
    create: {
      id: IDS.generatedAsset,
      studyMaterialId: studyMaterial.id,
      contentChunkId: chunk.id,
      assetType: 'flashcard',
      content: {
        front: 'What does F represent in F = m * a?',
        back: 'Force (in Newtons)'
      },
      metadata: {
        blooms_level: 'understanding'
      },
      generationModel: 'gpt-4o-mini',
      status: 'ready',
      qualityScore: 0.88,
      difficultyLevel: 3,
      generationParams: {
        temperature: 0.1
      }
    }
  });
}

async function seedLearningSession(user: { id: string }, studyMaterial: { id: string }) {
  return prisma.learningSession.upsert({
    where: { id: IDS.learningSession },
    update: { completionPercentage: 25 },
    create: {
      id: IDS.learningSession,
      userId: user.id,
      studyMaterialId: studyMaterial.id,
      sessionType: 'review',
      sessionData: { mode: 'adaptive' },
      totalInteractions: 1,
      completionPercentage: 25,
      status: 'active',
      configuration: { pace: 'normal' }
    }
  });
}

async function seedInteraction(
  session: { id: string },
  asset: { id: string },
  user: { id: string }
) {
  return prisma.interaction.upsert({
    where: { id: IDS.interaction },
    update: { confidenceLevel: 0.72 },
    create: {
      id: IDS.interaction,
      learningSessionId: session.id,
      generatedAssetId: asset.id,
      userId: user.id,
      interactionType: 'answer',
      interactionData: { answer: 'Force' },
      isCorrect: true,
      responseTimeMs: 2200,
      confidenceLevel: 0.72,
      feedbackData: { explanation: 'Direct recall' }
    }
  });
}

async function seedUserFeedback(
  user: { id: string },
  asset: { id: string },
  interaction: { id: string }
) {
  return prisma.userFeedback.upsert({
    where: { id: IDS.userFeedback },
    update: { rating: 5 },
    create: {
      id: IDS.userFeedback,
      userId: user.id,
      generatedAssetId: asset.id,
      interactionId: interaction.id,
      feedbackType: 'rating',
      rating: 5,
      comment: 'Great refresher!',
      metadata: { tone: 'positive' },
      status: 'active'
    }
  });
}

async function seedProgressMetric(user: { id: string }, session: { id: string }) {
  return prisma.progressMetric.upsert({
    where: { id: IDS.progressMetric },
    update: { metricValue: 0.78 },
    create: {
      id: IDS.progressMetric,
      userId: user.id,
      learningSessionId: session.id,
      metricType: 'accuracy',
      metricValue: 0.78,
      metricData: { window: 'daily' },
      timePeriod: 'daily',
      subjectArea: 'Physics',
      aggregationType: 'average'
    }
  });
}

async function seedAuditLog(user: { id: string }, session: { id: string }) {
  return prisma.auditLog.upsert({
    where: { id: IDS.auditLog },
    update: { action: 'session_resume' },
    create: {
      id: IDS.auditLog,
      userId: user.id,
      action: 'session_resume',
      entityType: 'learning_session',
      entityId: session.id,
      oldValues: { status: 'paused' },
      newValues: { status: 'active' },
      ipAddress: '192.168.10.5',
      userAgent: 'seed-script',
      sessionId: 'seed-session',
      isSuccess: true
    }
  });
}

async function main() {
  const { admin, learner } = await seedRolesAndUsers();
  const studyMaterial = await seedStudyMaterial(learner);
  const chunk = await seedContentChunk(studyMaterial);
  const asset = await seedGeneratedAsset(studyMaterial, chunk);
  const session = await seedLearningSession(learner, studyMaterial);
  const interaction = await seedInteraction(session, asset, learner);
  await seedUserFeedback(learner, asset, interaction);
  await seedProgressMetric(learner, session);
  await seedAuditLog(admin, session);

  console.log('✅ Database seed completed (roles, demo user, and reference data).');
}

main()
  .catch((error) => {
    console.error('❌ Failed to seed database', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
