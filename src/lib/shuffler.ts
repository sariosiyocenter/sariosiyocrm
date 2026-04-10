import { Question, Exam, ExamBlock } from '../types';

/**
 * Fisher-Yates Shuffle Algorithm
 */
export function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

export interface Variant {
    id: string;
    variantCode: string; // V001, V002, etc.
    questions: {
        questionId: number;
        order: number;
        shuffledOptions: {
            A: string;
            B: string;
            C: string;
            D: string;
        };
        correctOption: 'A' | 'B' | 'C' | 'D';
    }[];
}

/**
 * Generates variants based on the exam blueprint rules.
 */
export function generateVariants(
    exam: Exam, 
    allQuestions: Question[], 
    variantCount: number = 4
): Variant[] {
    const variants: Variant[] = [];

    for (let i = 0; i < variantCount; i++) {
        const variantCode = `V${(i + 1).toString().padStart(3, '0')}`;
        const variantQuestions: Variant['questions'] = [];
        let globalOrder = 1;

        // Process each block in the blueprint
        for (const block of exam.blocks) {
            // Process each topic rule within the block
            for (const rule of block.topicRules) {
                // 1. Filter questions for this specific topic and subject
                const matchingQuestions = allQuestions.filter(q => 
                    q.subject.toLowerCase() === block.subject.toLowerCase() &&
                    q.topic.toLowerCase() === rule.topic.toLowerCase()
                );

                if (matchingQuestions.length < rule.count) {
                    console.warn(`Not enough questions for topic: ${rule.topic} in ${block.subject}. Required: ${rule.count}, Found: ${matchingQuestions.length}`);
                }

                // 2. Shuffle and pick exactly 'rule.count' questions
                const selectedFromTopic = shuffleArray(matchingQuestions).slice(0, rule.count);

                // 3. For each selected question, shuffle its options
                for (const q of selectedFromTopic) {
                    const options = [
                        { key: 'A', text: q.optionA },
                        { key: 'B', text: q.optionB },
                        { key: 'C', text: q.optionC },
                        { key: 'D', text: q.optionD },
                    ];

                    const shuffled = shuffleArray(options);
                    const shuffledOptions = {
                        A: shuffled[0].text,
                        B: shuffled[1].text,
                        C: shuffled[2].text,
                        D: shuffled[3].text,
                    };

                    // Find the new key of the correct answer
                    const correctOption = ['A', 'B', 'C', 'D'][shuffled.findIndex(opt => opt.key === q.correctAnswer)] as 'A' | 'B' | 'C' | 'D';

                    variantQuestions.push({
                        questionId: q.id,
                        order: globalOrder++,
                        shuffledOptions,
                        correctOption
                    });
                }
            }
        }

        variants.push({
            id: Math.random().toString(36).substr(2, 9),
            variantCode,
            questions: variantQuestions
        });
    }

    return variants;
}
