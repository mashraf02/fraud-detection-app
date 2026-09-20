// UI strings (English + Bangla).
//
// `t('hero.ctaPrimary')` resolves a dotted path; `{{name}}` placeholders are
// filled from the second argument. A key missing or empty in the active locale
// falls back to the English value, so a partial translation renders the English
// string rather than a blank.
//
// Deliberately absent: latency figures, recall percentages, feature names,
// dataset sizes and retention promises as literals. Those are read from the
// running deployment, so the page cannot advertise something the system does not
// produce. Run `node .freebuff/check-keys.mjs` after touching this file: a
// missing key renders its own dotted path on screen, which neither the build nor
// the linter catches.

export const translations = {
  en: {
    nav: {
      subtitle: 'Decision Engine',
      simulator: 'Model Interface',
      pipeline: 'How It Works',
      features: 'Capabilities',
      benchmarks: 'Measured Performance',
      telemetry: 'Model live',
      telemetryOffline: 'Model unreachable',
      github: 'GitHub',
      launch: 'Open Console',
    },
    hero: {
      badge: 'Bring your own model — the console follows its interface',
      headlineLine1: 'Stop bad decisions',
      headlineLine2: 'before they ship.',
      description:
        'Fraud Radar validates an input vector against the schema the deployed model declares, scores it, stores the decision alongside the model version and threshold that produced it, and routes anything over the cut-off to a human reviewer. Every figure on this page is read from the running service.',
      ctaPrimary: 'Open the analyst console',
      ctaSecondary: 'See the live model interface',
      proof1Title: 'Audited by default',
      proof1Sub: 'Each score stored with its model version',
      proof2Title: 'Recall-first cut-off',
      proof2Sub: 'Chosen on held-out data, not for accuracy',
      proof3Title: 'No hardcoded schema',
      proof3Sub: 'Fields come from the model, not the frontend',
      consoleTitle: 'LIVE SCORING REQUEST',
      consoleBadgeLabel: 'ROC-AUC, held-out',
      liveTag: 'SCORED WHEN THIS PAGE LOADED',
      probeLine: 'MEAN ROW · {{count}} features',
      cutOffLabel: 'Cut-off',
      probabilityLabel: 'MODEL PROBABILITY',
      modelLabel: 'MODEL',
      verdictFlagged: 'FLAGGED → REVIEW',
      verdictCleared: 'CLEARED',
      scoredIn: '{{ms}} ms',
      awaiting: 'Scoring…',
      errorTitle: 'Scoring API unreachable',
      errorBody: 'The console needs the backend. Start it, then reload this page.',
      note: 'The console sent a zero vector for all {{count}} declared features — the dataset mean once inputs are standardised — and this card shows the response. Any model exposing the same contract is driven the same way.',
    },
    stats: {
      eyebrow: 'MEASURED PERFORMANCE',
      title: 'Numbers produced by the training run',
      subtitle:
        'Read from the deployed model artifact. These come from a held-out split that the scaler and the classifier never saw — the leakage bug where the scaler was fitted on all the data is fixed, and a regression test keeps it fixed.',
      evaluated: 'Rows in the dataset',
      evaluatedSub: 'Labelled rows used for training',
      recall: 'Recall at cut-off',
      recallSub: 'Positives caught on the held-out split',
      precision: 'Precision at cut-off',
      precisionSub: 'Flagged rows that were genuinely positive',
      prAuc: 'PR-AUC',
      prAucSub: 'No-skill baseline {{baseline}}',
      loading: 'Reading model metrics…',
      unavailable: 'Metrics unavailable — the API did not respond.',
      ofTestRows: 'on {{rows}} held-out rows · {{fraud}} positives',
    },
    interface: {
      eyebrow: 'DECLARED INTERFACE',
      title: 'The console asks the model what it needs',
      subtitle:
        'Feature names, count and order are read from the API at runtime. Nothing about this model is hardcoded in the interface, so the same console serves a different model, or a different domain, without a frontend change.',
      featuresLabel: 'Features declared by the model ({{count}})',
      featuresNote:
        'These names come straight from the deployed artifact. The inspector renders exactly this list — add a feature to the model and the form grows with it.',
      featuresUnavailable: 'The model interface could not be read, so the expected fields are unknown.',
      probeTitle: 'The form is generated, not written',
      probeBody:
        'The landing page scored a zero vector across all {{count}} features the moment it loaded and got {{probability}} back. That was a real inference, not a screenshot.',
      probeWaiting: 'Waiting for the API to answer before claiming a number…',
      cta: 'Open the console',
      modelLabel: 'Deployed model',
      available: 'interface available',
      loading: 'reading…',
      unavailable: 'unreachable',
      rowCutOff: 'Decision cut-off',
      rowMetrics: 'Held-out operating point',
      metricsValue: 'recall {{recall}} · precision {{precision}}',
      rowDataset: 'Training dataset',
      datasetValue: '{{rows}} rows · {{positives}} positives',
      rowValidation: 'Validation split',
      validationValue: '{{rows}} rows · {{positives}} positives',
      rowRuntime: 'Runtime',
      rowTrained: 'Trained',
      note: 'Every value on this panel is read from the model artifact at runtime.',
    },
    pipeline: {
      eyebrow: 'HOW A REQUEST IS SERVED',
      title: 'The request path, end to end',
      subtitle:
        'One scoring call walks all of this, and all of it sits on the request path — validation, persistence, inference, audit.',
      step1Title: 'Validate & store',
      step1Body:
        'The vector is validated against the declared schema, then written as a row so the decision can be reproduced later.',
      step2Title: 'Scale & score',
      step2BodyPre: 'The saved',
      step2BodyPost:
        'scaler — fitted on the training split only — transforms the continuous inputs, and the calibrated classifier scores the whole batch in one vectorised call.',
      step3Title: 'Apply the cut-off',
      step3Body:
        'The threshold comes from configuration or from the model’s own recommendation, and is recorded on every prediction, so you can always tell which rule was in force.',
      appliedCutOff: '(applied: {{value}}, source: {{source}})',
      step4Title: 'Route & audit',
      step4Body:
        'Rows over the cut-off are escalated for human review. Actor, decision and payload are appended to an audit trail that is never rewritten.',
      latencyLabel: 'Last measured scoring call',
      latencyAwaiting: 'waiting for the first call',
    },
    features: {
      eyebrow: 'TWO WAYS IN',
      title: 'One row at a time, or a whole file',
      subtitle:
        'Both paths run through the same scoring service, the same persistence layer and the same audit trail.',
      singleBadge: 'INTERACTIVE',
      singleTitle: 'Single row inspector',
      singleDesc:
        'Fill in every feature the model declares and score one row. The response carries the probability, the threshold that was applied, the model version and the measured latency.',
      singleCta: 'Open the inspector',
      batchBadge: 'CSV BATCH',
      batchTitle: 'Batch screening',
      batchDesc:
        'Drop in a CSV of rows. They are validated against the declared schema up front, scored in a single vectorised pass, persisted, and returned per row.',
      batchCta: 'Screen a CSV',
      batchLimit:
        'Batches are size-capped on the server; an oversized request is rejected with an explicit error instead of being attempted.',
      previewEndpointSingle: 'POST /predict',
      previewEndpointSingleStatus: 'one row in',
      previewEndpointHistory: 'GET /predictions',
      previewEndpointHistoryStatus: 'history + audit',
      previewEndpointBatch: 'POST /predict/batch',
      previewEndpointBatchStatus: 'size-capped',
      previewLatencyLabel: 'Measured latency',
      previewRowsLabel: 'Validation',
      previewRowsValue: 'per-field errors',
      bannerTag: 'REVIEW WORKFLOW',
      bannerTitle: 'Flagged rows become cases',
      bannerDesc:
        'A flagged row keeps its probability, applied threshold, model version and decision history, so a reviewer can see exactly why the engine escalated it.',
      bannerCta: 'Open the console',
    },
    trust: {
      eyebrow: 'TRUST MODEL',
      heading: 'Audit-first, not amnesia-first.',
      body: 'Fraud Radar keeps the evidence: what was scored, by which model version, against which threshold, and who decided what.',
      item1Title: 'Your database, your data',
      item1Body:
        'Rows, predictions, decisions and audit events live in the database this service is pointed at — nothing is shipped to a third party.',
      item2Title: 'Decisions stay reproducible',
      item2Body:
        'Every prediction records the model version and threshold used, so a decision is still explainable after the next retrain.',
      item3Title: 'Metrics that cannot drift',
      item3Body:
        'The figures on this page are read from the model artifact at runtime. The UI holds no hardcoded numbers to fall out of date.',
    },
    cta: {
      heading: 'Score something real',
      sub: 'Open the console to inspect a row against the live model, or screen a whole CSV.',
      primary: 'Open the analyst console',
      secondary: 'View the source',
    },
    footer: {
      tagline:
        'Risk decisioning with a stored audit trail. The console follows whatever interface the deployed model declares.',
      badgeModel: 'model {{version}}',
      badgeSklearn: 'scikit-learn {{version}}',
      badgePython: 'python {{version}}',
      trainedAt: 'Trained {{when}}',
      platform: 'Platform',
      resources: 'Resources',
      githubRepo: 'GitHub Repository',
      kaggle: 'Dataset source',
      docs: 'Technical Documentation',
      createdBy: 'Created By',
      authorBio: 'Computer Science & Engineering, IUB',
      authorStatus: 'Available for high-impact AI/SWE roles',
      copyright:
        'Fraud Radar. Local decision-support for human review — not an autonomous payment gateway.',
      license: 'MIT License',
      openApp: 'Open App',
      apiStatus: 'API',
      apiOnline: 'online',
      apiOffline: 'unreachable',
    },
  },

  bn: {
    nav: {
      subtitle: 'সিদ্ধান্ত ইঞ্জিন',
      simulator: 'মডেল ইন্টারফেস',
      pipeline: 'কীভাবে কাজ করে',
      features: 'সক্ষমতা',
      benchmarks: 'পরিমাপকৃত কর্মক্ষমতা',
      telemetry: 'মডেল সক্রিয়',
      telemetryOffline: 'মডেল পৌঁছানোর বাইরে',
      github: 'GitHub',
      launch: 'কনসোল খুলুন',
    },
    hero: {
      badge: 'নিজের মডেল আনুন — কনসোল তার ইন্টারফেস অনুসরণ করে',
      headlineLine1: 'খারাপ সিদ্ধান্ত থামান',
      headlineLine2: 'নিষ্পত্তির আগেই।',
      description:
        'ফ্রড রাডার ডিপ্লয় করা মডেল যে স্কিমা ঘোষণা করে তা দিয়েই ইনপুট যাচাই করে, স্কোর করে, যে মডেল সংস্করণ ও থ্রেশহোল্ড দিয়ে সিদ্ধান্ত হয়েছে তা সংরক্ষণ করে, এবং কাট-অফ ছাড়িয়ে যাওয়া সারি মানব পর্যালোচকের কাছে পাঠায়। এই পাতার প্রতিটি সংখ্যা চলমান সেবা থেকেই পড়া হয়।',
      ctaPrimary: 'বিশ্লেষক কনসোল খুলুন',
      ctaSecondary: 'লাইভ মডেল ইন্টারফেস দেখুন',
      proof1Title: 'ডিফল্টভাবেই অডিটেড',
      proof1Sub: 'প্রতিটি স্কোর মডেল সংস্করণসহ সংরক্ষিত',
      proof2Title: 'রিকল-অগ্রাধিকার কাট-অফ',
      proof2Sub: 'হোল্ড-আউট ডেটায় বেছে নেওয়া, অ্যাকুরেসির জন্য নয়',
      proof3Title: 'কোনো হার্ডকোডেড স্কিমা নেই',
      proof3Sub: 'ফিল্ডগুলো মডেল থেকে আসে, ফ্রন্টএন্ড থেকে নয়',
      consoleTitle: 'লাইভ স্কোরিং রিকোয়েস্ট',
      consoleBadgeLabel: 'ROC-AUC, হোল্ড-আউট',
      liveTag: 'পাতা লোড হওয়ার সময় স্কোর করা',
      probeLine: 'গড় সারি · {{count}}টি ফিচার',
      cutOffLabel: 'কাট-অফ',
      probabilityLabel: 'মডেল সম্ভাবনা',
      modelLabel: 'মডেল',
      verdictFlagged: 'চিহ্নিত → পর্যালোচনা',
      verdictCleared: 'ক্লিয়ার',
      scoredIn: '{{ms}} মি.সে.',
      awaiting: 'স্কোর হচ্ছে…',
      errorTitle: 'স্কোরিং এপিআই-এ পৌঁছানো যাচ্ছে না',
      errorBody: 'কনসোলের জন্য ব্যাকএন্ড প্রয়োজন। এটি চালু করে পাতা রিলোড করুন।',
      note: 'কনসোল ঘোষিত সবগুলো {{count}} ফিচারের জন্য শূন্য ভেক্টর পাঠিয়েছে — স্ট্যান্ডার্ডাইজেশনের পর এটিই ডেটাসেটের গড় — এবং এই কার্ডটি সেই উত্তর দেখাচ্ছে। একই চুক্তি যেকোনো মডেল এভাবে চালানো যায়।',
    },
    stats: {
      eyebrow: 'পরিমাপকৃত কর্মক্ষমতা',
      title: 'প্রশিক্ষণ রান থেকে পাওয়া সংখ্যা',
      subtitle:
        'ডিপ্লয় করা মডেল আর্টিফ্যাক্ট থেকে পড়া। এগুলো এমন হোল্ড-আউট স্প্লিট থেকে যা স্কেলার ও ক্লাসিফায়ার কখনো দেখেনি — স্কেলার পুরো ডেটায় ফিট করার লিকেজ বাগটি সংশোধিত, এবং একটি রিগ্রেশন টেস্ট সেটি সংশোধিত রাখে।',
      evaluated: 'ডেটাসেটের সারি',
      evaluatedSub: 'প্রশিক্ষণে ব্যবহৃত লেবেলযুক্ত সারি',
      recall: 'কাট-অফে রিকল',
      recallSub: 'হোল্ড-আউট স্প্লিটে ধরা পড়া পজিটিভ',
      precision: 'কাট-অফে প্রিসিশন',
      precisionSub: 'চিহ্নিত সারির মধ্যে প্রকৃত পজিটিভ',
      prAuc: 'PR-AUC',
      prAucSub: 'নো-স্কিল বেসলাইন {{baseline}}',
      loading: 'মডেল মেট্রিক্স পড়া হচ্ছে…',
      unavailable: 'মেট্রিক্স পাওয়া যায়নি — এপিআই সাড়া দেয়নি।',
      ofTestRows: '{{rows}} হোল্ড-আউট সারিতে · {{fraud}}টি পজিটিভ',
    },
    interface: {
      eyebrow: 'ঘোষিত ইন্টারফেস',
      title: 'কনসোল মডেলের কাছেই জিজ্ঞেস করে তার কী দরকার',
      subtitle:
        'ফিচারের নাম, সংখ্যা ও ক্রম রানটাইমে এপিআই থেকে পড়া হয়। এই মডেল সম্পর্কে ইন্টারফেসে কিছুই হার্ডকোড করা নেই, তাই একই কনসোল ফ্রন্টএন্ড পরিবর্তন ছাড়াই ভিন্ন মডেল বা ভিন্ন ডোমেইন সামলায়।',
      featuresLabel: 'মডেল যে ফিচারগুলো ঘোষণা করে ({{count}})',
      featuresNote:
        'এই নামগুলো সরাসরি ডিপ্লয় করা আর্টিফ্যাক্ট থেকে আসে। ইন্সপেক্টর ঠিক এই তালিকাই দেখায় — মডেলে একটি ফিচার যোগ করলে ফর্মটিও তার সাথে বাড়ে।',
      featuresUnavailable: 'মডেল ইন্টারফেস পড়া যায়নি, তাই প্রত্যাশিত ফিল্ডগুলো অজানা।',
      probeTitle: 'ফর্মটি লেখা নয়, তৈরি হয়',
      probeBody:
        'পাতা লোড হওয়ার মুহূর্তেই কনসোল ঘোষিত সবগুলো {{count}} ফিচারে শূন্য ভেক্টর স্কোর করেছে এবং {{probability}} ফিরে পেয়েছে। এটা বাস্তব ইনফারেন্স, কোনো স্ক্রিনশট নয়।',
      probeWaiting: 'সংখ্যা দাবি করার আগে এপিআই-এর উত্তরের অপেক্ষায়…',
      cta: 'কনসোল খুলুন',
      modelLabel: 'ডিপ্লয় করা মডেল',
      available: 'ইন্টারফেস পাওয়া গেছে',
      loading: 'পড়া হচ্ছে…',
      unavailable: 'পৌঁছানো যাচ্ছে না',
      rowCutOff: 'সিদ্ধান্তের কাট-অফ',
      rowMetrics: 'হোল্ড-আউট অপারেটিং পয়েন্ট',
      metricsValue: 'রিকল {{recall}} · প্রিসিশন {{precision}}',
      rowDataset: 'প্রশিক্ষণ ডেটাসেট',
      datasetValue: '{{rows}} সারি · {{positives}}টি পজিটিভ',
      rowValidation: 'ভ্যালিডেশন স্প্লিট',
      validationValue: '{{rows}} সারি · {{positives}}টি পজিটিভ',
      rowRuntime: 'রানটাইম',
      rowTrained: 'প্রশিক্ষণ',
      note: 'এই প্যানেলের প্রতিটি মান রানটাইমে মডেল আর্টিফ্যাক্ট থেকে পড়া।',
    },
    pipeline: {
      eyebrow: 'একটি রিকোয়েস্ট কীভাবে সেবা পায়',
      title: 'রিকোয়েস্টের পথ, শুরু থেকে শেষ',
      subtitle:
        'একটি স্কোরিং কল এই সবকিছু অতিক্রম করে, এবং সবটাই রিকোয়েস্টের পথেই থাকে — যাচাই, সংরক্ষণ, ইনফারেন্স, অডিট।',
      step1Title: 'যাচাই ও সংরক্ষণ',
      step1Body:
        'ভেক্টরটি ঘোষিত স্কিমার বিপরীতে যাচাই হয়, তারপর একটি সারি হিসেবে লেখা হয় যাতে সিদ্ধান্ত পরে পুনরুৎপাদন করা যায়।',
      step2Title: 'স্কেল ও স্কোর',
      step2BodyPre: 'সংরক্ষিত',
      step2BodyPost:
        'স্কেলার — কেবল ট্রেনিং স্প্লিটে ফিট করা — ধারাবাহিক ইনপুট রূপান্তর করে, এবং ক্যালিব্রেটেড ক্লাসিফায়ার পুরো ব্যাচ এক ভেক্টরাইজড কলে স্কোর করে।',
      step3Title: 'কাট-অফ প্রয়োগ',
      step3Body:
        'থ্রেশহোল্ড কনফিগারেশন বা মডেলের নিজস্ব সুপারিশ থেকে আসে, এবং প্রতিটি প্রেডিকশনে রেকর্ড করা হয় — ফলে কোন নিয়ম চালু ছিল তা সবসময় জানা যায়।',
      appliedCutOff: '(প্রয়োগ: {{value}}, সূত্র: {{source}})',
      step4Title: 'রাউটিং ও অডিট',
      step4Body:
        'কাট-অফ ছাড়ানো সারি মানব পর্যালোচনার জন্য এস্কেলেট হয়। কে, কী সিদ্ধান্ত ও কোন পেলোড — সব একটি অপরিবর্তনীয় অডিট ট্রেইলে যোগ হয়।',
      latencyLabel: 'সর্বশেষ পরিমাপকৃত স্কোরিং কল',
      latencyAwaiting: 'প্রথম কলের অপেক্ষায়',
    },
    features: {
      eyebrow: 'প্রবেশের দুই পথ',
      title: 'একটি সারি, কিংবা পুরো একটি ফাইল',
      subtitle:
        'দুটি পথই একই স্কোরিং সেবা, একই সংরক্ষণ স্তর ও একই অডিট ট্রেইল ব্যবহার করে।',
      singleBadge: 'ইন্টারঅ্যাকটিভ',
      singleTitle: 'একক সারি ইন্সপেক্টর',
      singleDesc:
        'মডেল যে ফিচারগুলো ঘোষণা করে সবগুলো পূরণ করে একটি সারি স্কোর করুন। উত্তরে থাকে সম্ভাবনা, প্রয়োগকৃত থ্রেশহোল্ড, মডেল সংস্করণ ও পরিমাপকৃত লেটেন্সি।',
      singleCta: 'ইন্সপেক্টর খুলুন',
      batchBadge: 'CSV ব্যাচ',
      batchTitle: 'ব্যাচ স্ক্রিনিং',
      batchDesc:
        'সারিগুলোর একটি CSV ফাইল দিন। আগেই ঘোষিত স্কিমার বিপরীতে যাচাই হয়, এক ভেক্টরাইজড পাসে স্কোর হয়, সংরক্ষণ হয় এবং সারি ধরে ফেরত দেওয়া হয়।',
      batchCta: 'একটি CSV স্ক্রিন করুন',
      batchLimit:
        'সার্ভারে ব্যাচের আকার সীমিত; সীমা ছাড়ানো রিকোয়েস্ট চেষ্টা না করে স্পষ্ট ত্রুটি দিয়ে প্রত্যাখ্যাত হয়।',
      previewEndpointSingle: 'POST /predict',
      previewEndpointSingleStatus: 'একটি সারি',
      previewEndpointHistory: 'GET /predictions',
      previewEndpointHistoryStatus: 'ইতিহাস + অডিট',
      previewEndpointBatch: 'POST /predict/batch',
      previewEndpointBatchStatus: 'আকার-সীমিত',
      previewLatencyLabel: 'পরিমাপকৃত লেটেন্সি',
      previewRowsLabel: 'যাচাই',
      previewRowsValue: 'প্রতি-ফিল্ড ত্রুটি',
      bannerTag: 'পর্যালোচনা কার্যপ্রবাহ',
      bannerTitle: 'চিহ্নিত সারি কেস হয়ে যায়',
      bannerDesc:
        'চিহ্নিত সারি তার সম্ভাবনা, প্রয়োগকৃত থ্রেশহোল্ড, মডেল সংস্করণ ও সিদ্ধান্তের ইতিহাস ধরে রাখে — ফলে পর্যালোচক দেখতে পারেন ইঞ্জিন কেন এটি এস্কেলেট করল।',
      bannerCta: 'কনসোল খুলুন',
    },
    trust: {
      eyebrow: 'ট্রাস্ট মডেল',
      heading: 'অডিট-প্রথম, বিস্মৃতি নয়।',
      body: 'ফ্রড রাডার প্রমাণ রেখে দেয়: কী স্কোর হয়েছে, কোন মডেল সংস্করণে, কোন থ্রেশহোল্ডে, এবং কে কী সিদ্ধান্ত নিয়েছে।',
      item1Title: 'আপনার ডেটাবেস, আপনার ডেটা',
      item1Body:
        'সারি, প্রেডিকশন, সিদ্ধান্ত ও অডিট ইভেন্ট এই সেবা যে ডেটাবেসে যুক্ত তা-তেই থাকে — কোনো তৃতীয় পক্ষের কাছে পাঠানো হয় না।',
      item2Title: 'সিদ্ধান্ত পুনরুৎপাদনযোগ্য',
      item2Body:
        'প্রতিটি প্রেডিকশন ব্যবহৃত মডেল সংস্করণ ও থ্রেশহোল্ড রেকর্ড করে, ফলে পরবর্তী রিট্রেনের পরেও সিদ্ধান্ত ব্যাখ্যাযোগ্য থাকে।',
      item3Title: 'যে মেট্রিক্স বিভ্রান্ত হয় না',
      item3Body:
        'এই পাতার সংখ্যাগুলো রানটাইমে মডেল আর্টিফ্যাক্ট থেকে পড়া। UI-তে বাসি হয়ে যাওয়ার মতো কোনো হার্ডকোডেড সংখ্যা নেই।',
    },
    cta: {
      heading: 'বাস্তব কিছু স্কোর করুন',
      sub: 'লাইভ মডেলের বিপরীতে একটি সারি পরিদর্শন করতে কনসোল খুলুন, কিংবা পুরো একটি CSV স্ক্রিন করুন।',
      primary: 'বিশ্লেষক কনসোল খুলুন',
      secondary: 'সোর্স দেখুন',
    },
    footer: {
      tagline:
        'সংরক্ষিত অডিট ট্রেইলসহ ঝুঁকি সিদ্ধান্ত। ডিপ্লয় করা মডেল যে ইন্টারফেস ঘোষণা করে, কনসোল তা-ই অনুসরণ করে।',
      badgeModel: 'মডেল {{version}}',
      badgeSklearn: 'scikit-learn {{version}}',
      badgePython: 'python {{version}}',
      trainedAt: 'প্রশিক্ষণ {{when}}',
      platform: 'প্ল্যাটফর্ম',
      resources: 'রিসোর্স',
      githubRepo: 'GitHub রিপোজিটরি',
      kaggle: 'ডেটাসেটের সূত্র',
      docs: 'টেকনিক্যাল ডকুমেন্টেশন',
      createdBy: 'নির্মাতা',
      authorBio: 'কম্পিউটার সায়েন্স অ্যান্ড ইঞ্জিনিয়ারিং, IUB',
      authorStatus: 'উচ্চ-প্রভাবশালী AI/SWE পদে কাজের জন্য উপলব্ধ',
      copyright:
        'ফ্রড রাডার। মানব পর্যালোচনার জন্য লোকাল সিদ্ধান্ত-সহায়ক — স্বায়ত্তশাসিত পেমেন্ট গেটওয়ে নয়।',
      license: 'MIT লাইসেন্স',
      openApp: 'অ্যাপ খুলুন',
      apiStatus: 'এপিআই',
      apiOnline: 'চালু',
      apiOffline: 'পৌঁছানো যাচ্ছে না',
    },
  },
}

export default translations
