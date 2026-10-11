import type { TestCatalogEntry } from "./types";

/** Inert A1 tasks from user-provided HTML; answer keys remain server-only. */
export const A1_GRAMMAR_TESTS: TestCatalogEntry[] = [
  {
    "id": "a1-to-be",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "Present simple: to be",
    "subtitle": "Am, is, are · statements, negatives & questions",
    "cover": {
      "src": "/images/tests/a1-to-be-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: Present simple: to be"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Choose the correct present simple forms of ‘to be’ for the gaps below.",
        "questions": [
          {
            "id": "q1",
            "before": "A: ",
            "after": " you a teacher? B: Yes, I ….",
            "options": [
              "is",
              "Are"
            ]
          },
          {
            "id": "q2",
            "before": "A: … you a teacher? B: Yes, I ",
            "after": ".",
            "options": [
              "are",
              "am"
            ]
          },
          {
            "id": "q3",
            "before": "A: ",
            "after": " your name Marcus? B: Yes, it ….",
            "options": [
              "Is",
              "Are"
            ]
          },
          {
            "id": "q4",
            "before": "A: … your name Marcus? B: Yes, it ",
            "after": ".",
            "options": [
              "are",
              "is"
            ]
          },
          {
            "id": "q5",
            "before": "A: ",
            "after": " your children here? B: No, they ….",
            "options": [
              "am",
              "Are"
            ]
          },
          {
            "id": "q6",
            "before": "A: … your children here? B: No, they ",
            "after": ".",
            "options": [
              "isn't",
              "aren't"
            ]
          },
          {
            "id": "q7",
            "before": "A: ",
            "after": " this your suitcase? B: No, it ….",
            "options": [
              "Are",
              "Is"
            ]
          },
          {
            "id": "q8",
            "before": "A: … this your suitcase? B: No, it ",
            "after": ".",
            "options": [
              "aren't",
              "isn't"
            ]
          },
          {
            "id": "q9",
            "before": "A: Where ",
            "after": " we? B: I think this … Oxford street.",
            "options": [
              "are",
              "am",
              "is"
            ]
          },
          {
            "id": "q10",
            "before": "A: Where … we? B: I think this ",
            "after": " Oxford street.",
            "options": [
              "are",
              "is"
            ]
          },
          {
            "id": "q11",
            "before": "A: ",
            "after": " it Saturday today? B: No, It … Sunday.",
            "options": [
              "Is",
              "Are"
            ]
          },
          {
            "id": "q12",
            "before": "A: … it Saturday today? B: No, It ",
            "after": " Sunday.",
            "options": [
              "'re",
              "'s"
            ]
          },
          {
            "id": "q13",
            "before": "A: ",
            "after": " your friends from the UK? B: No, … from the US.",
            "options": [
              "Are",
              "Is"
            ]
          },
          {
            "id": "q14",
            "before": "A: … your friends from the UK? B: No, ",
            "after": " from the US.",
            "options": [
              "he is",
              "they are"
            ]
          },
          {
            "id": "q15",
            "before": "A: Hello, Maria. How ",
            "after": " you? B: … fine, thanks.",
            "options": [
              "am",
              "are"
            ]
          },
          {
            "id": "q16",
            "before": "A: Hello, Maria. How … you? B: ",
            "after": " fine, thanks.",
            "options": [
              "I'm",
              "I are"
            ]
          },
          {
            "id": "q17",
            "before": "A: How old ",
            "after": " Peter? B: I think … 30 years old.",
            "options": [
              "are",
              "is"
            ]
          },
          {
            "id": "q18",
            "before": "A: How old … Peter? B: I think ",
            "after": " 30 years old.",
            "options": [
              "it is",
              "he is"
            ]
          },
          {
            "id": "q19",
            "before": "A: ",
            "after": " David and Molly here? B: Yes, … next to the door.",
            "options": [
              "Are",
              "Is"
            ]
          },
          {
            "id": "q20",
            "before": "A: … David and Molly here? B: Yes, ",
            "after": " next to the door.",
            "options": [
              "they're",
              "we're"
            ]
          }
        ],
        "passage": [
          [
            {
              "text": "A: "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " you a teacher? B: Yes, I "
            },
            {
              "questionId": "q2"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "A: "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " your name Marcus? B: Yes, it "
            },
            {
              "questionId": "q4"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "A: "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " your children here? B: No, they "
            },
            {
              "questionId": "q6"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "A: "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " this your suitcase? B: No, it "
            },
            {
              "questionId": "q8"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "A: Where "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " we? B: I think this "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " Oxford street."
            }
          ],
          [
            {
              "text": "A: "
            },
            {
              "questionId": "q11"
            },
            {
              "text": " it Saturday today? B: No, It "
            },
            {
              "questionId": "q12"
            },
            {
              "text": " Sunday."
            }
          ],
          [
            {
              "text": "A: "
            },
            {
              "questionId": "q13"
            },
            {
              "text": " your friends from the UK? B: No, "
            },
            {
              "questionId": "q14"
            },
            {
              "text": " from the US."
            }
          ],
          [
            {
              "text": "A: Hello, Maria. How "
            },
            {
              "questionId": "q15"
            },
            {
              "text": " you? B: "
            },
            {
              "questionId": "q16"
            },
            {
              "text": " fine, thanks."
            }
          ],
          [
            {
              "text": "A: How old "
            },
            {
              "questionId": "q17"
            },
            {
              "text": " Peter? B: I think "
            },
            {
              "questionId": "q18"
            },
            {
              "text": " 30 years old."
            }
          ],
          [
            {
              "text": "A: "
            },
            {
              "questionId": "q19"
            },
            {
              "text": " David and Molly here? B: Yes, "
            },
            {
              "questionId": "q20"
            },
            {
              "text": " next to the door."
            }
          ]
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Rewrite the sentences using the short forms of be.",
        "questions": [
          {
            "id": "q1",
            "before": "She is fantastic ⇒ ",
            "after": " fantastic.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "We are in Spain ⇒ ",
            "after": " in Spain.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "You are not my friend ⇒ You ",
            "after": " my friend.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "Sheila is from Brighton. ⇒ ",
            "after": " from Brighton.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "The chairs are not expensive. ⇒ The chairs ",
            "after": " expensive.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "I am not British ⇒ ",
            "after": " British.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "Clara is a good student. ⇒ ",
            "after": " a good student.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "You are great. ⇒ ",
            "after": " great.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "They are my friends. ⇒ ",
            "after": " my friends.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "He is not angry. ⇒ He ",
            "after": " angry.",
            "options": [],
            "kind": "text"
          }
        ],
        "context": "EXAMPLE: They are good friends ⇒ They’re good friends.",
        "passage": [
          [
            {
              "text": "She is fantastic ⇒ "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " fantastic."
            }
          ],
          [
            {
              "text": "We are in Spain ⇒ "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " in Spain."
            }
          ],
          [
            {
              "text": "You are not my friend ⇒ You "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " my friend."
            }
          ],
          [
            {
              "text": "Sheila is from Brighton. ⇒ "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " from Brighton."
            }
          ],
          [
            {
              "text": "The chairs are not expensive. ⇒ The chairs "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " expensive."
            }
          ],
          [
            {
              "text": "I am not British ⇒ "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " British."
            }
          ],
          [
            {
              "text": "Clara is a good student. ⇒ "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " a good student."
            }
          ],
          [
            {
              "text": "You are great. ⇒ "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " great."
            }
          ],
          [
            {
              "text": "They are my friends. ⇒ "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " my friends."
            }
          ],
          [
            {
              "text": "He is not angry. ⇒ He "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " angry."
            }
          ]
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Rewrite these sentences using the negative and interrogative forms of ‘to be’. Use contractions when possible.",
        "questions": [
          {
            "id": "q1",
            "before": "She is a teacher. ⇒ ",
            "after": " a teacher. ⇒ … a teacher?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "She is a teacher. ⇒ … a teacher. ⇒ ",
            "after": " a teacher?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "They're in Berlin. ⇒ ",
            "after": " in Berlin. ⇒ … in Berlin?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "They're in Berlin. ⇒ … in Berlin. ⇒ ",
            "after": " in Berlin?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "It's a nice day. ⇒ ",
            "after": " a nice day. ⇒ … a nice day?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "It's a nice day. ⇒ … a nice day. ⇒ ",
            "after": " a nice day?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "I am very excited. ⇒ ",
            "after": " very excited. ⇒ … very excited?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "I am very excited. ⇒ … very excited. ⇒ ",
            "after": " very excited?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "We are students. ⇒ ",
            "after": " students. ⇒ … students?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "We are students. ⇒ … students. ⇒ ",
            "after": " students?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q11",
            "before": "You are right. ⇒ ",
            "after": " right. ⇒ … right?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q12",
            "before": "You are right. ⇒ … right. ⇒ ",
            "after": " right?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q13",
            "before": "It's 6 o'clock. ⇒ ",
            "after": " 6 o'clock. ⇒ … 6 o'clock?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q14",
            "before": "It's 6 o'clock. ⇒ … 6 o'clock. ⇒ ",
            "after": " 6 o'clock?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q15",
            "before": "The table is blue. ⇒ ",
            "after": " blue. ⇒ … blue?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q16",
            "before": "The table is blue. ⇒ … blue. ⇒ ",
            "after": " blue?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q17",
            "before": "He is the new manager. ⇒ ",
            "after": " the new manager. ⇒ … the new manager?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q18",
            "before": "He is the new manager. ⇒ … the new manager. ⇒ ",
            "after": " the new manager?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q19",
            "before": "They are sorry. ⇒ ",
            "after": " sorry. ⇒ … sorry?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q20",
            "before": "They are sorry. ⇒ … sorry. ⇒ ",
            "after": " sorry?",
            "options": [],
            "kind": "text"
          }
        ],
        "context": "EXAMPLE: They are friends ⇒ They aren’t friends. ⇒ Are they friends?",
        "passage": [
          [
            {
              "text": "She is a teacher. ⇒ "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " a teacher. ⇒ "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " a teacher?"
            }
          ],
          [
            {
              "text": "They're in Berlin. ⇒ "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " in Berlin. ⇒ "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " in Berlin?"
            }
          ],
          [
            {
              "text": "It's a nice day. ⇒ "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " a nice day. ⇒ "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " a nice day?"
            }
          ],
          [
            {
              "text": "I am very excited. ⇒ "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " very excited. ⇒ "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " very excited?"
            }
          ],
          [
            {
              "text": "We are students. ⇒ "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " students. ⇒ "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " students?"
            }
          ],
          [
            {
              "text": "You are right. ⇒ "
            },
            {
              "questionId": "q11"
            },
            {
              "text": " right. ⇒ "
            },
            {
              "questionId": "q12"
            },
            {
              "text": " right?"
            }
          ],
          [
            {
              "text": "It's 6 o'clock. ⇒ "
            },
            {
              "questionId": "q13"
            },
            {
              "text": " 6 o'clock. ⇒ "
            },
            {
              "questionId": "q14"
            },
            {
              "text": " 6 o'clock?"
            }
          ],
          [
            {
              "text": "The table is blue. ⇒ "
            },
            {
              "questionId": "q15"
            },
            {
              "text": " blue. ⇒ "
            },
            {
              "questionId": "q16"
            },
            {
              "text": " blue?"
            }
          ],
          [
            {
              "text": "He is the new manager. ⇒ "
            },
            {
              "questionId": "q17"
            },
            {
              "text": " the new manager. ⇒ "
            },
            {
              "questionId": "q18"
            },
            {
              "text": " the new manager?"
            }
          ],
          [
            {
              "text": "They are sorry. ⇒ "
            },
            {
              "questionId": "q19"
            },
            {
              "text": " sorry. ⇒ "
            },
            {
              "questionId": "q20"
            },
            {
              "text": " sorry?"
            }
          ]
        ]
      },
      {
        "id": "exercise-4",
        "number": 4,
        "instruction": "Fill in the gaps with the correct present simple forms of ‘to be’.",
        "questions": [
          {
            "id": "q1",
            "before": "SOFIE: Hello.  ",
            "after": " you from here?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "DINO: No, we  ",
            "after": ". And you?  … you from here?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "DINO: No, we  …. And you?  ",
            "after": " you from here?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "SOFIE: No, I  ",
            "after": " from France. My name  … SOFIE.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "SOFIE: No, I  … from France. My name  ",
            "after": " SOFIE.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "DINO: Nice to meet you. I  ",
            "after": " DINO. And this  … Francesca.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "DINO: Nice to meet you. I  … DINO. And this  ",
            "after": " Francesca.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "SOFIE: Where  ",
            "after": " you from?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "DINO: We  ",
            "after": " from Italy.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "SOFIE:  ",
            "after": " you from Rome?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q11",
            "before": "DINO: No, we  ",
            "after": ". We  … from the north of Italy. I  … from Torino, and Francesca  … from Milano.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q12",
            "before": "DINO: No, we  …. We  ",
            "after": " from the north of Italy. I  … from Torino, and Francesca  … from Milano.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q13",
            "before": "DINO: No, we  …. We  … from the north of Italy. I  ",
            "after": " from Torino, and Francesca  … from Milano.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q14",
            "before": "DINO: No, we  …. We  … from the north of Italy. I  … from Torino, and Francesca  ",
            "after": " from Milano.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q15",
            "before": "SOFIE:  ",
            "after": " you here on holiday?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q16",
            "before": "DINO: No, we  ",
            "after": ". It  … a study trip. This  … a beautiful place.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q17",
            "before": "DINO: No, we  …. It  ",
            "after": " a study trip. This  … a beautiful place.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q18",
            "before": "DINO: No, we  …. It  … a study trip. This  ",
            "after": " a beautiful place.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q19",
            "before": "SOFIE: Yes, it  ",
            "after": ".  … the trip nice?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q20",
            "before": "SOFIE: Yes, it  ….  ",
            "after": " the trip nice?",
            "options": [],
            "kind": "text"
          }
        ],
        "passage": [
          [
            {
              "text": "SOFIE: Hello.  "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " you from here?"
            }
          ],
          [
            {
              "text": "DINO: No, we  "
            },
            {
              "questionId": "q2"
            },
            {
              "text": ". And you?  "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " you from here?"
            }
          ],
          [
            {
              "text": "SOFIE: No, I  "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " from France. My name  "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " SOFIE."
            }
          ],
          [
            {
              "text": "DINO: Nice to meet you. I  "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " DINO. And this  "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " Francesca."
            }
          ],
          [
            {
              "text": "SOFIE: Where  "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " you from?"
            }
          ],
          [
            {
              "text": "DINO: We  "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " from Italy."
            }
          ],
          [
            {
              "text": "SOFIE:  "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " you from Rome?"
            }
          ],
          [
            {
              "text": "DINO: No, we  "
            },
            {
              "questionId": "q11"
            },
            {
              "text": ". We  "
            },
            {
              "questionId": "q12"
            },
            {
              "text": " from the north of Italy. I  "
            },
            {
              "questionId": "q13"
            },
            {
              "text": " from Torino, and Francesca  "
            },
            {
              "questionId": "q14"
            },
            {
              "text": " from Milano."
            }
          ],
          [
            {
              "text": "SOFIE:  "
            },
            {
              "questionId": "q15"
            },
            {
              "text": " you here on holiday?"
            }
          ],
          [
            {
              "text": "DINO: No, we  "
            },
            {
              "questionId": "q16"
            },
            {
              "text": ". It  "
            },
            {
              "questionId": "q17"
            },
            {
              "text": " a study trip. This  "
            },
            {
              "questionId": "q18"
            },
            {
              "text": " a beautiful place."
            }
          ],
          [
            {
              "text": "SOFIE: Yes, it  "
            },
            {
              "questionId": "q19"
            },
            {
              "text": ".  "
            },
            {
              "questionId": "q20"
            },
            {
              "text": " the trip nice?"
            }
          ],
          [
            {
              "text": "DINO: Very nice"
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-demonstratives",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "This, that, these, those",
    "subtitle": "Demonstrative pronouns · near & far",
    "cover": {
      "src": "/images/tests/a1-demonstratives-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: This, that, these, those"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Complete the sentences with this, that, these, those.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": " are my trousers.",
            "options": [
              "This",
              "These"
            ]
          },
          {
            "id": "q2",
            "before": "'Hi, Chris. ",
            "after": " is my friend Jona.' 'Hi, Jona. Nice to meet you.'",
            "options": [
              "This",
              "That"
            ]
          },
          {
            "id": "q3",
            "before": "Look at ",
            "after": " birds in the sky.",
            "options": [
              "those",
              "these"
            ]
          },
          {
            "id": "q4",
            "before": "'What are ",
            "after": "?' 'They are my books.'",
            "options": [
              "those",
              "that"
            ]
          },
          {
            "id": "q5",
            "before": "Is ",
            "after": " hotel nice?",
            "options": [
              "that",
              "those"
            ]
          },
          {
            "id": "q6",
            "before": "Are ",
            "after": " your friends?",
            "options": [
              "these",
              "this"
            ]
          },
          {
            "id": "q7",
            "before": "Who is ",
            "after": " man over there?",
            "options": [
              "this",
              "that"
            ]
          },
          {
            "id": "q8",
            "before": "Isn't ",
            "after": " your friend Erik?",
            "options": [
              "this",
              "these"
            ]
          },
          {
            "id": "q9",
            "before": "Why are ",
            "after": " boxes here?",
            "options": [
              "those",
              "these"
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": " are my glasses.",
            "options": [
              "These",
              "That"
            ]
          }
        ],
        "passage": [
          [
            {
              "questionId": "q1"
            },
            {
              "text": " are my trousers."
            }
          ],
          [
            {
              "text": "'Hi, Chris. "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " is my friend Jona.' 'Hi, Jona. Nice to meet you.'"
            }
          ],
          [
            {
              "text": "Look at "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " birds in the sky."
            }
          ],
          [
            {
              "text": "'What are "
            },
            {
              "questionId": "q4"
            },
            {
              "text": "?' 'They are my books.'"
            }
          ],
          [
            {
              "text": "Is "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " hotel nice?"
            }
          ],
          [
            {
              "text": "Are "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " your friends?"
            }
          ],
          [
            {
              "text": "Who is "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " man over there?"
            }
          ],
          [
            {
              "text": "Isn't "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " your friend Erik?"
            }
          ],
          [
            {
              "text": "Why are "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " boxes here?"
            }
          ],
          [
            {
              "questionId": "q10"
            },
            {
              "text": " are my glasses."
            }
          ]
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Choose this, that, these, those to complete the following sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": "",
            "prompt": "'What's _____?' 'It's a calculator.'",
            "options": [
              "this",
              "these"
            ]
          },
          {
            "id": "q2",
            "before": "",
            "after": "",
            "prompt": "______ are John and Teresa.",
            "options": [
              "This",
              "These"
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": "",
            "prompt": "Hi, Richard, _____ is Julia. (On the phone)",
            "options": [
              "this",
              "that"
            ]
          },
          {
            "id": "q4",
            "before": "",
            "after": "",
            "prompt": "Look at _____ cloud. It's very strange.",
            "options": [
              "this",
              "that"
            ]
          },
          {
            "id": "q5",
            "before": "",
            "after": "",
            "prompt": "'What are _____?' 'They are little cakes.'",
            "options": [
              "that",
              "those"
            ]
          },
          {
            "id": "q6",
            "before": "",
            "after": "",
            "prompt": "_____ are my keys.",
            "options": [
              "That",
              "Those"
            ]
          },
          {
            "id": "q7",
            "before": "",
            "after": "",
            "prompt": "Is _____ your mother?",
            "options": [
              "this",
              "these"
            ]
          },
          {
            "id": "q8",
            "before": "",
            "after": "",
            "prompt": "What is in _____ box over there?",
            "options": [
              "this",
              "that"
            ]
          },
          {
            "id": "q9",
            "before": "",
            "after": "",
            "prompt": "_____ is my hand!",
            "options": [
              "This",
              "That"
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": "",
            "prompt": "_____ are my cats.",
            "options": [
              "this",
              "those"
            ]
          }
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Transform singular sentences into plural sentences and plural sentences into singular sentences using this, that, these, those and other missing words.",
        "questions": [
          {
            "id": "q1",
            "before": "This is a flower ⇒ ",
            "after": " flowers.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "That is a box. ⇒ ",
            "after": " boxes.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "That is my father. ⇒ ",
            "after": " my parents.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "Are those your friends? ⇒ ",
            "after": " your friend?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "What are those things? ⇒ What ",
            "after": " thing?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "These documents are important. ⇒ ",
            "after": " important.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "Are these your shoes? ⇒ ",
            "after": " your shoe?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "That's a good car. ⇒ ",
            "after": " good cars.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "This is John. ⇒ ",
            "after": " John and Carla.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "These are cheap computers. ⇒ ",
            "after": " a cheap computer.",
            "options": [],
            "kind": "text"
          }
        ],
        "context": "EXAMPLE: These are my books ⇒ This is my book.",
        "passage": [
          [
            {
              "text": "This is a flower ⇒ "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " flowers."
            }
          ],
          [
            {
              "text": "That is a box. ⇒ "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " boxes."
            }
          ],
          [
            {
              "text": "That is my father. ⇒ "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " my parents."
            }
          ],
          [
            {
              "text": "Are those your friends? ⇒ "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " your friend?"
            }
          ],
          [
            {
              "text": "What are those things? ⇒ What "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " thing?"
            }
          ],
          [
            {
              "text": "These documents are important. ⇒ "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " important."
            }
          ],
          [
            {
              "text": "Are these your shoes? ⇒ "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " your shoe?"
            }
          ],
          [
            {
              "text": "That's a good car. ⇒ "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " good cars."
            }
          ],
          [
            {
              "text": "This is John. ⇒ "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " John and Carla."
            }
          ],
          [
            {
              "text": "These are cheap computers. ⇒ "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " a cheap computer."
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-possessives",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "Possessive adjectives & pronouns",
    "subtitle": "I/my, you/your · subjects & possession",
    "cover": {
      "src": "/images/tests/a1-possessives-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: Possessive adjectives & pronouns"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Choose the correct subject pronouns or possessive adjectives to complete the sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "Harry is ",
            "after": " friend. … has a nice house.",
            "options": [
              "I",
              "my"
            ]
          },
          {
            "id": "q2",
            "before": "Harry is … friend. ",
            "after": " has a nice house.",
            "options": [
              "His",
              "He"
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": " are very happy with … new dog.",
            "options": [
              "They",
              "Their"
            ]
          },
          {
            "id": "q4",
            "before": "… are very happy with ",
            "after": " new dog.",
            "options": [
              "their",
              "they"
            ]
          },
          {
            "id": "q5",
            "before": "We love ",
            "after": " little dog.",
            "options": [
              "our",
              "we"
            ]
          },
          {
            "id": "q6",
            "before": "",
            "after": " wants … breakfast.",
            "options": [
              "He",
              "His"
            ]
          },
          {
            "id": "q7",
            "before": "… wants ",
            "after": " breakfast.",
            "options": [
              "his",
              "he"
            ]
          },
          {
            "id": "q8",
            "before": "We want to see ",
            "after": " children.",
            "options": [
              "our",
              "ours"
            ]
          },
          {
            "id": "q9",
            "before": "Scotland is famous for ",
            "after": " rainy weather.",
            "options": [
              "its",
              "it's"
            ]
          },
          {
            "id": "q10",
            "before": "Susan lives on ",
            "after": " street. … house is very near.",
            "options": [
              "my",
              "I"
            ]
          },
          {
            "id": "q11",
            "before": "Susan lives on … street. ",
            "after": " house is very near.",
            "options": [
              "Her",
              "His"
            ]
          },
          {
            "id": "q12",
            "before": "'What are those?' '",
            "after": " postcards.'",
            "options": [
              "It is",
              "They are"
            ]
          },
          {
            "id": "q13",
            "before": "I like this place and ",
            "after": " special atmosphere.",
            "options": [
              "its",
              "it's"
            ]
          },
          {
            "id": "q14",
            "before": "I love this place. ",
            "after": " very special.",
            "options": [
              "Its",
              "It's"
            ]
          }
        ],
        "passage": [
          [
            {
              "text": "Harry is "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " friend. "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " has a nice house."
            }
          ],
          [
            {
              "questionId": "q3"
            },
            {
              "text": " are very happy with "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " new dog."
            }
          ],
          [
            {
              "text": "We love "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " little dog."
            }
          ],
          [
            {
              "questionId": "q6"
            },
            {
              "text": " wants "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " breakfast."
            }
          ],
          [
            {
              "text": "We want to see "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " children."
            }
          ],
          [
            {
              "text": "Scotland is famous for "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " rainy weather."
            }
          ],
          [
            {
              "text": "Susan lives on "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " street. "
            },
            {
              "questionId": "q11"
            },
            {
              "text": " house is very near."
            }
          ],
          [
            {
              "text": "'What are those?' '"
            },
            {
              "questionId": "q12"
            },
            {
              "text": " postcards.'"
            }
          ],
          [
            {
              "text": "I like this place and "
            },
            {
              "questionId": "q13"
            },
            {
              "text": " special atmosphere."
            }
          ],
          [
            {
              "text": "I love this place. "
            },
            {
              "questionId": "q14"
            },
            {
              "text": " very special."
            }
          ]
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Choose the correct subject pronouns or possessive adjectives to complete the following sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": "",
            "prompt": "Go to _____ office.",
            "options": [
              "you",
              "your",
              "yours"
            ]
          },
          {
            "id": "q2",
            "before": "",
            "after": "",
            "prompt": "_____ six o'clock. Let's go home.",
            "options": [
              "It's",
              "Its",
              "His"
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": "",
            "prompt": "Our products are famous for _____ durability.",
            "options": [
              "their",
              "its",
              "they"
            ]
          },
          {
            "id": "q4",
            "before": "",
            "after": "",
            "prompt": "I'm very happy about _____ marks.",
            "options": [
              "you",
              "your",
              "yours"
            ]
          },
          {
            "id": "q5",
            "before": "",
            "after": "",
            "prompt": "Valeria is from Italy, but _____ 's in Ireland now.",
            "options": [
              "his",
              "her",
              "she"
            ]
          },
          {
            "id": "q6",
            "before": "",
            "after": "",
            "prompt": "These are my friends. _____ from Finland.",
            "options": [
              "Their",
              "They're",
              "They"
            ]
          },
          {
            "id": "q7",
            "before": "",
            "after": "",
            "prompt": "The apartment has _____ own private garden.",
            "options": [
              "it's",
              "its",
              "his"
            ]
          },
          {
            "id": "q8",
            "before": "",
            "after": "",
            "prompt": "Are _____ umbrellas here?",
            "options": [
              "we",
              "ours",
              "our"
            ]
          },
          {
            "id": "q9",
            "before": "",
            "after": "",
            "prompt": "Mark and Linda are in _____ caravan.",
            "options": [
              "they",
              "their",
              "its"
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": "",
            "prompt": "I need _____ tools, please.",
            "options": [
              "your",
              "you",
              "yours"
            ]
          }
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Fill in the gaps with the correct possessive adjectives: my, your, his, her, its, our, their.",
        "questions": [
          {
            "id": "q1",
            "before": "Sally is in ",
            "after": " room.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "Paul and Benet always help ",
            "after": " friends.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "We live with ",
            "after": " parents.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "Is that ",
            "after": " hat?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "The police officers don't have ",
            "after": " guns.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "The best part of this car is ",
            "after": " price.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "Amanda lives with ",
            "after": " parents.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "I don't like ",
            "after": " new job.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "These shoes are famous for ",
            "after": " comfort.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "Thomas is in ",
            "after": " office.",
            "options": [],
            "kind": "text"
          }
        ],
        "passage": [
          [
            {
              "text": "Sally is in "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " room."
            }
          ],
          [
            {
              "text": "Paul and Benet always help "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " friends."
            }
          ],
          [
            {
              "text": "We live with "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " parents."
            }
          ],
          [
            {
              "text": "Is that "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " hat?"
            }
          ],
          [
            {
              "text": "The police officers don't have "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " guns."
            }
          ],
          [
            {
              "text": "The best part of this car is "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " price."
            }
          ],
          [
            {
              "text": "Amanda lives with "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " parents."
            }
          ],
          [
            {
              "text": "I don't like "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " new job."
            }
          ],
          [
            {
              "text": "These shoes are famous for "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " comfort."
            }
          ],
          [
            {
              "text": "Thomas is in "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " office."
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-a-an-plurals",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "A/an & plurals",
    "subtitle": "Singular and plural forms",
    "cover": {
      "src": "/images/tests/a1-a-an-plurals-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: A/an & plurals"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Choose a/an for the following words.",
        "questions": [
          {
            "id": "q1",
            "before": "It's ",
            "after": " animal.",
            "options": [
              "an",
              "a"
            ]
          },
          {
            "id": "q2",
            "before": "I need ",
            "after": " new bed.",
            "options": [
              "an",
              "a"
            ]
          },
          {
            "id": "q3",
            "before": "It's ",
            "after": " useful machine.",
            "options": [
              "a",
              "an"
            ]
          },
          {
            "id": "q4",
            "before": "I'm ",
            "after": " waiter.",
            "options": [
              "an",
              "a"
            ]
          },
          {
            "id": "q5",
            "before": "Do you have ",
            "after": " umbrella?",
            "options": [
              "an",
              "a"
            ]
          },
          {
            "id": "q6",
            "before": "I'm ",
            "after": " English teacher.",
            "options": [
              "a",
              "an"
            ]
          },
          {
            "id": "q7",
            "before": "I need ",
            "after": " hat.",
            "options": [
              "a",
              "an"
            ]
          },
          {
            "id": "q8",
            "before": "Is she ",
            "after": " student?",
            "options": [
              "a",
              "an"
            ]
          },
          {
            "id": "q9",
            "before": "We have ",
            "after": " ugly duck.",
            "options": [
              "an",
              "a"
            ]
          },
          {
            "id": "q10",
            "before": "I need ",
            "after": " hour.",
            "options": [
              "a",
              "an"
            ]
          }
        ],
        "passage": [
          [
            {
              "text": "It's "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " animal."
            }
          ],
          [
            {
              "text": "I need "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " new bed."
            }
          ],
          [
            {
              "text": "It's "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " useful machine."
            }
          ],
          [
            {
              "text": "I'm "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " waiter."
            }
          ],
          [
            {
              "text": "Do you have "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " umbrella?"
            }
          ],
          [
            {
              "text": "I'm "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " English teacher."
            }
          ],
          [
            {
              "text": "I need "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " hat."
            }
          ],
          [
            {
              "text": "Is she "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " student?"
            }
          ],
          [
            {
              "text": "We have "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " ugly duck."
            }
          ],
          [
            {
              "text": "I need "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " hour."
            }
          ]
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Write the plurals of the following singular words.",
        "questions": [
          {
            "id": "q1",
            "before": "a university ⇒ ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "a sandwich ⇒ ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "a street ⇒ ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "a rich man ⇒ rich ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "one foot ⇒ two ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "a dirty bag ⇒ dirty ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "an expensive watch ⇒ expensive ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "a new phone ⇒ new ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "a nice photograph ⇒ nice ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "One glass of wine ⇒ two ",
            "after": " of wine",
            "options": [],
            "kind": "text"
          }
        ],
        "context": "EXAMPLE: A nice sofa ⇒ nice sofas",
        "passage": [
          [
            {
              "text": "a university ⇒ "
            },
            {
              "questionId": "q1"
            }
          ],
          [
            {
              "text": "a sandwich ⇒ "
            },
            {
              "questionId": "q2"
            }
          ],
          [
            {
              "text": "a street ⇒ "
            },
            {
              "questionId": "q3"
            }
          ],
          [
            {
              "text": "a rich man ⇒ rich "
            },
            {
              "questionId": "q4"
            }
          ],
          [
            {
              "text": "one foot ⇒ two "
            },
            {
              "questionId": "q5"
            }
          ],
          [
            {
              "text": "a dirty bag ⇒ dirty "
            },
            {
              "questionId": "q6"
            }
          ],
          [
            {
              "text": "an expensive watch ⇒ expensive "
            },
            {
              "questionId": "q7"
            }
          ],
          [
            {
              "text": "a new phone ⇒ new "
            },
            {
              "questionId": "q8"
            }
          ],
          [
            {
              "text": "a nice photograph ⇒ nice "
            },
            {
              "questionId": "q9"
            }
          ],
          [
            {
              "text": "One glass of wine ⇒ two "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " of wine"
            }
          ]
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Write a/an before the singular words and write the plural forms.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": " bus ⇒ …",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "… bus ⇒ ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "",
            "after": " nice family ⇒ nice …",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "… nice family ⇒ nice ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "",
            "after": " Italian child ⇒ Italian …",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "… Italian child ⇒ Italian ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "",
            "after": " strong tooth ⇒ strong …",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "… strong tooth ⇒ strong ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "",
            "after": " nice dress ⇒ nice …",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "… nice dress ⇒ nice ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q11",
            "before": "",
            "after": " angry wife ⇒ angry …",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q12",
            "before": "… angry wife ⇒ angry ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q13",
            "before": "",
            "after": " uniform ⇒ …",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q14",
            "before": "… uniform ⇒ ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q15",
            "before": "",
            "after": " amazing website ⇒ amazing …",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q16",
            "before": "… amazing website ⇒ amazing ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q17",
            "before": "",
            "after": " elephant ⇒ …",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q18",
            "before": "… elephant ⇒ ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q19",
            "before": "",
            "after": " empty library ⇒ empty …",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q20",
            "before": "… empty library ⇒ empty ",
            "after": "",
            "options": [],
            "kind": "text"
          }
        ],
        "context": "EXAMPLE: An olive ⇒ olives",
        "passage": [
          [
            {
              "questionId": "q1"
            },
            {
              "text": " bus ⇒ "
            },
            {
              "questionId": "q2"
            }
          ],
          [
            {
              "questionId": "q3"
            },
            {
              "text": " nice family ⇒ nice "
            },
            {
              "questionId": "q4"
            }
          ],
          [
            {
              "questionId": "q5"
            },
            {
              "text": " Italian child ⇒ Italian "
            },
            {
              "questionId": "q6"
            }
          ],
          [
            {
              "questionId": "q7"
            },
            {
              "text": " strong tooth ⇒ strong "
            },
            {
              "questionId": "q8"
            }
          ],
          [
            {
              "questionId": "q9"
            },
            {
              "text": " nice dress ⇒ nice "
            },
            {
              "questionId": "q10"
            }
          ],
          [
            {
              "questionId": "q11"
            },
            {
              "text": " angry wife ⇒ angry "
            },
            {
              "questionId": "q12"
            }
          ],
          [
            {
              "questionId": "q13"
            },
            {
              "text": " uniform ⇒ "
            },
            {
              "questionId": "q14"
            }
          ],
          [
            {
              "questionId": "q15"
            },
            {
              "text": " amazing website ⇒ amazing "
            },
            {
              "questionId": "q16"
            }
          ],
          [
            {
              "questionId": "q17"
            },
            {
              "text": " elephant ⇒ "
            },
            {
              "questionId": "q18"
            }
          ],
          [
            {
              "questionId": "q19"
            },
            {
              "text": " empty library ⇒ empty "
            },
            {
              "questionId": "q20"
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-adjectives",
    "version": 2,
    "level": "a1",
    "category": "grammar",
    "title": "Adjectives: the basics",
    "subtitle": "Old, interesting, expensive · adjective order",
    "cover": {
      "src": "/images/tests/a1-adjectives-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: Adjectives: the basics"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Choose the correct forms with adjectives to complete the following sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "With this makeup, your eyes ",
            "after": ".",
            "options": [
              "look differents",
              "look different",
              "different look"
            ]
          },
          {
            "id": "q2",
            "before": "These are ",
            "after": ".",
            "options": [
              "documents important",
              "documents importants",
              "important documents"
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": " in their new house?",
            "options": [
              "Are they happy",
              "Are they happies",
              "Are happy they"
            ]
          },
          {
            "id": "q4",
            "before": "He has ",
            "after": ".",
            "options": [
              "an interesting job",
              "a job interesting"
            ]
          },
          {
            "id": "q5",
            "before": "Sit down. You ",
            "after": ".",
            "options": [
              "smell tired",
              "look tired",
              "tired look"
            ]
          },
          {
            "id": "q6",
            "before": "Our holidays ",
            "after": ".",
            "options": [
              "are fantastic",
              "fantastic are",
              "are fantastics"
            ]
          },
          {
            "id": "q7",
            "before": "John has problems at home. ",
            "after": "?",
            "options": [
              "Are goods his marks",
              "Are good his marks",
              "Are his marks good"
            ]
          },
          {
            "id": "q8",
            "before": "Their project ",
            "after": ".",
            "options": [
              "tastes interesting",
              "interesting looks",
              "sounds interesting"
            ]
          },
          {
            "id": "q9",
            "before": "These cookies ",
            "after": ".",
            "options": [
              "excellent are",
              "are excellents",
              "are excellent"
            ]
          },
          {
            "id": "q10",
            "before": "Her eyes ",
            "after": ".",
            "options": [
              "blue are",
              "are blues",
              "are blue"
            ]
          }
        ],
        "passage": [
          [
            {
              "text": "With this makeup, your eyes "
            },
            {
              "questionId": "q1"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "These are "
            },
            {
              "questionId": "q2"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "questionId": "q3"
            },
            {
              "text": " in their new house?"
            }
          ],
          [
            {
              "text": "He has "
            },
            {
              "questionId": "q4"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "Sit down. You "
            },
            {
              "questionId": "q5"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "Our holidays "
            },
            {
              "questionId": "q6"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "John has problems at home. "
            },
            {
              "questionId": "q7"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "Their project "
            },
            {
              "questionId": "q8"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "These cookies "
            },
            {
              "questionId": "q9"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "Her eyes "
            },
            {
              "questionId": "q10"
            },
            {
              "text": "."
            }
          ]
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Put the words in the correct order.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": "",
            "prompt": "Which is the correct order?",
            "options": [
              "Your great idea is.",
              "Your idea is great.",
              "Great your idea is.",
              "Your idea great is."
            ]
          },
          {
            "id": "q2",
            "before": "",
            "after": "",
            "prompt": "Which is the correct order?",
            "options": [
              "She an exceptional student is.",
              "She is a student exceptional.",
              "She is an exceptional student.",
              "She a student exceptional is."
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": "",
            "prompt": "Which is the correct order?",
            "options": [
              "Is this shirt Italian?",
              "Is Italian this shirt?",
              "This shirt Italian is?",
              "This shirt is Italian?"
            ]
          },
          {
            "id": "q4",
            "before": "",
            "after": "",
            "prompt": "Which is the correct order?",
            "options": [
              "That restaurant very dirty is.",
              "That is a restaurant very dirty.",
              "Very dirty is that restaurant.",
              "That restaurant is very dirty."
            ]
          },
          {
            "id": "q5",
            "before": "",
            "after": "",
            "prompt": "Which is the correct order?",
            "options": [
              "He a Korean car has.",
              "He has a Korean car.",
              "He has a car Korean.",
              "A car Korean he has."
            ]
          },
          {
            "id": "q6",
            "before": "",
            "after": "",
            "prompt": "Which is the correct order?",
            "options": [
              "This is our restaurant favourite.",
              "Our favourite restaurant is this.",
              "Is this our restaurant favourite?",
              "This is our favourite restaurant."
            ]
          },
          {
            "id": "q7",
            "before": "",
            "after": "",
            "prompt": "Which is the correct order?",
            "options": [
              "It's a building very modern.",
              "It's a very modern building.",
              "Very modern it's a building.",
              "A building very modern is."
            ]
          },
          {
            "id": "q8",
            "before": "",
            "after": "",
            "prompt": "Which is the correct order?",
            "options": [
              "Are your friends German?",
              "Are German your friends?",
              "German are your friends?",
              "Your friends are German?"
            ]
          },
          {
            "id": "q9",
            "before": "",
            "after": "",
            "prompt": "Which is the correct order?",
            "options": [
              "This language difficult is.",
              "A language difficult this is.",
              "This is a difficult language.",
              "This is a language difficult."
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": "",
            "prompt": "Which is the correct order?",
            "options": [
              "This language is difficult.",
              "This language difficult is.",
              "Is difficult this language?",
              "This language is difficult?"
            ]
          }
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Complete the senteces using (a/an) adjective + noun or using be + adjective.",
        "questions": [
          {
            "id": "q1",
            "before": "exam / easy ⇒ This exam ",
            "after": ". It's …",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "exam / easy ⇒ This exam …. It's ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "watch / old ⇒ This watch ",
            "after": ". It's ….",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "watch / old ⇒ This watch …. It's ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "exotic / countries ⇒ These countries ",
            "after": ". They're ….",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "exotic / countries ⇒ These countries …. They're ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "view / amazing ⇒ The view ",
            "after": ". It's ….",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "view / amazing ⇒ The view …. It's ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "difficult / situation ⇒ The situation ",
            "after": ". It's ….",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "difficult / situation ⇒ The situation …. It's ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q11",
            "before": "cars / fast ⇒ These cars ",
            "after": ". They are ….",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q12",
            "before": "cars / fast ⇒ These cars …. They are ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q13",
            "before": "dangerous / city ⇒ It's ",
            "after": ". This city ….",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q14",
            "before": "dangerous / city ⇒ It's …. This city ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q15",
            "before": "expensive / clothes ⇒ These clothes ",
            "after": ". They're ….",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q16",
            "before": "expensive / clothes ⇒ These clothes …. They're ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q17",
            "before": "man / strong ⇒ He's ",
            "after": ". This man …",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q18",
            "before": "man / strong ⇒ He's …. This man ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q19",
            "before": "box / empty ⇒ This box ",
            "after": ". It's …",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q20",
            "before": "box / empty ⇒ This box …. It's ",
            "after": "",
            "options": [],
            "kind": "text"
          }
        ],
        "context": "EXAMPLE: heavy / table ⇒ This table is heavy . It’s a heavy table.",
        "passage": [
          [
            {
              "text": "exam / easy ⇒ This exam "
            },
            {
              "questionId": "q1"
            },
            {
              "text": ". It's "
            },
            {
              "questionId": "q2"
            }
          ],
          [
            {
              "text": "watch / old ⇒ This watch "
            },
            {
              "questionId": "q3"
            },
            {
              "text": ". It's "
            },
            {
              "questionId": "q4"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "exotic / countries ⇒ These countries "
            },
            {
              "questionId": "q5"
            },
            {
              "text": ". They're "
            },
            {
              "questionId": "q6"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "view / amazing ⇒ The view "
            },
            {
              "questionId": "q7"
            },
            {
              "text": ". It's "
            },
            {
              "questionId": "q8"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "difficult / situation ⇒ The situation "
            },
            {
              "questionId": "q9"
            },
            {
              "text": ". It's "
            },
            {
              "questionId": "q10"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "cars / fast ⇒ These cars "
            },
            {
              "questionId": "q11"
            },
            {
              "text": ". They are "
            },
            {
              "questionId": "q12"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "dangerous / city ⇒ It's "
            },
            {
              "questionId": "q13"
            },
            {
              "text": ". This city "
            },
            {
              "questionId": "q14"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "expensive / clothes ⇒ These clothes "
            },
            {
              "questionId": "q15"
            },
            {
              "text": ". They're "
            },
            {
              "questionId": "q16"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "man / strong ⇒ He's "
            },
            {
              "questionId": "q17"
            },
            {
              "text": ". This man "
            },
            {
              "questionId": "q18"
            }
          ],
          [
            {
              "text": "box / empty ⇒ This box "
            },
            {
              "questionId": "q19"
            },
            {
              "text": ". It's "
            },
            {
              "questionId": "q20"
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-present-simple",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "Present simple: I do, I don't, Do I?",
    "subtitle": "A1 grammar · all exercises",
    "cover": {
      "src": "/images/tests/a1-present-simple-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: Present simple: I do, I don't, Do I?"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Choose the correct present simple forms to complete the following sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "I ",
            "after": " tea.",
            "options": [
              "don't drink",
              "drink not",
              "not drink"
            ]
          },
          {
            "id": "q2",
            "before": "She ",
            "after": " two brothers.",
            "options": [
              "have",
              "haves",
              "has"
            ]
          },
          {
            "id": "q3",
            "before": "Tom ",
            "after": " work until 10 today.",
            "options": [
              "do not start",
              "doesn't start",
              "doesn't starts"
            ]
          },
          {
            "id": "q4",
            "before": "",
            "after": " an instrument?",
            "options": [
              "You do play",
              "You play",
              "Do you play"
            ]
          },
          {
            "id": "q5",
            "before": "The museum ",
            "after": " at 10 o'clock.",
            "options": [
              "open",
              "does open",
              "opens"
            ]
          },
          {
            "id": "q6",
            "before": "Peter and Megan often ",
            "after": " to the cinema.",
            "options": [
              "go",
              "goes",
              "do go"
            ]
          },
          {
            "id": "q7",
            "before": "John ",
            "after": " very late.",
            "options": [
              "do not get up",
              "doesn't gets up",
              "doesn't get up"
            ]
          },
          {
            "id": "q8",
            "before": "What time ",
            "after": " home in the morning?",
            "options": [
              "do they leave",
              "they do leave",
              "they leave"
            ]
          },
          {
            "id": "q9",
            "before": "What language ",
            "after": "?",
            "options": [
              "does he study",
              "does he studies",
              "do he studies"
            ]
          },
          {
            "id": "q10",
            "before": "My son never ",
            "after": " cartoons.",
            "options": [
              "watches",
              "watchs",
              "watch"
            ]
          }
        ],
        "passage": [
          [
            {
              "text": "I "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " tea."
            }
          ],
          [
            {
              "text": "She "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " two brothers."
            }
          ],
          [
            {
              "text": "Tom "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " work until 10 today."
            }
          ],
          [
            {
              "questionId": "q4"
            },
            {
              "text": " an instrument?"
            }
          ],
          [
            {
              "text": "The museum "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " at 10 o'clock."
            }
          ],
          [
            {
              "text": "Peter and Megan often "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " to the cinema."
            }
          ],
          [
            {
              "text": "John "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " very late."
            }
          ],
          [
            {
              "text": "What time "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " home in the morning?"
            }
          ],
          [
            {
              "text": "What language "
            },
            {
              "questionId": "q9"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "My son never "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " cartoons."
            }
          ]
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Transform the following sentences into negatives.",
        "questions": [
          {
            "id": "q1",
            "before": "He is a student. ⇒ He ",
            "after": " a student.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "Peter works in an office. ⇒ Peter ",
            "after": " in an office.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "My parents live in Arizona. ⇒ My parents ",
            "after": " in Arizona.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "Suzan likes cats. ⇒ Suzan ",
            "after": " cats.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "He has brothers and sisters. ⇒ He ",
            "after": " any brothers or sisters.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "She speaks three languages. ⇒ She ",
            "after": " three languages.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "John and I want to be musicians. ⇒ John and I ",
            "after": " to be musicians.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "They play tennis. ⇒ They ",
            "after": " tennis.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "She gets home late. ⇒ She ",
            "after": " home late.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "Anna and Paul live in the center. ⇒ Anna and Paul ",
            "after": " in the center.",
            "options": [],
            "kind": "text"
          }
        ],
        "context": "EXAMPLE: I love pizza. ⇒ I don’t love pizza.",
        "passage": [
          [
            {
              "text": "He is a student. ⇒ He "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " a student."
            }
          ],
          [
            {
              "text": "Peter works in an office. ⇒ Peter "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " in an office."
            }
          ],
          [
            {
              "text": "My parents live in Arizona. ⇒ My parents "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " in Arizona."
            }
          ],
          [
            {
              "text": "Suzan likes cats. ⇒ Suzan "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " cats."
            }
          ],
          [
            {
              "text": "He has brothers and sisters. ⇒ He "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " any brothers or sisters."
            }
          ],
          [
            {
              "text": "She speaks three languages. ⇒ She "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " three languages."
            }
          ],
          [
            {
              "text": "John and I want to be musicians. ⇒ John and I "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " to be musicians."
            }
          ],
          [
            {
              "text": "They play tennis. ⇒ They "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " tennis."
            }
          ],
          [
            {
              "text": "She gets home late. ⇒ She "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " home late."
            }
          ],
          [
            {
              "text": "Anna and Paul live in the center. ⇒ Anna and Paul "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " in the center."
            }
          ]
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Write questions in present simple.",
        "questions": [
          {
            "id": "q1",
            "before": "Laura / play / tennis ⇒ ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "you / speak / English ⇒ ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "you / want / some coffee ⇒ ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "Where / he / live ⇒ Where ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "How often / they / go to the cinema ⇒ How often ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "What time / Suzan / start work ⇒ What time ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "Where / she / work ⇒ Where ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "you / listen to music ⇒ ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "he / watch / series ⇒ ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "How often / they / travel ⇒ How often ",
            "after": "?",
            "options": [],
            "kind": "text"
          }
        ],
        "context": "EXAMPLE: Peter / drive / a fast car. ⇒ Does Peter drive a fast car?",
        "passage": [
          [
            {
              "text": "Laura / play / tennis ⇒ "
            },
            {
              "questionId": "q1"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "you / speak / English ⇒ "
            },
            {
              "questionId": "q2"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "you / want / some coffee ⇒ "
            },
            {
              "questionId": "q3"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "Where / he / live ⇒ Where "
            },
            {
              "questionId": "q4"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "How often / they / go to the cinema ⇒ How often "
            },
            {
              "questionId": "q5"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "What time / Suzan / start work ⇒ What time "
            },
            {
              "questionId": "q6"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "Where / she / work ⇒ Where "
            },
            {
              "questionId": "q7"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "you / listen to music ⇒ "
            },
            {
              "questionId": "q8"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "he / watch / series ⇒ "
            },
            {
              "questionId": "q9"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "How often / they / travel ⇒ How often "
            },
            {
              "questionId": "q10"
            },
            {
              "text": "?"
            }
          ]
        ]
      },
      {
        "id": "exercise-4",
        "number": 4,
        "instruction": "Fill in the gaps with the verbs in brackets in present simple affirmative or negative.",
        "questions": [
          {
            "id": "q1",
            "before": "Sara is my daughter. She has (have) two daughters; they are my granddaughters. Sara  ",
            "after": " (not have) much free time because she  … (work) in a shop. In the week, she  … (get up) very early and she  … (go) to bed quite late every day. She  … (love) Sundays because she  … (not work) and she  … (spend) the day with her family. On Sundays, they  … (not get up) very late because they always  … (go out). My granddaughters  … (be) always sad on Sunday evenings because it's the end of the weekend.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "Sara is my daughter. She has (have) two daughters; they are my granddaughters. Sara  … (not have) much free time because she  ",
            "after": " (work) in a shop. In the week, she  … (get up) very early and she  … (go) to bed quite late every day. She  … (love) Sundays because she  … (not work) and she  … (spend) the day with her family. On Sundays, they  … (not get up) very late because they always  … (go out). My granddaughters  … (be) always sad on Sunday evenings because it's the end of the weekend.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "Sara is my daughter. She has (have) two daughters; they are my granddaughters. Sara  … (not have) much free time because she  … (work) in a shop. In the week, she  ",
            "after": " (get up) very early and she  … (go) to bed quite late every day. She  … (love) Sundays because she  … (not work) and she  … (spend) the day with her family. On Sundays, they  … (not get up) very late because they always  … (go out). My granddaughters  … (be) always sad on Sunday evenings because it's the end of the weekend.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "Sara is my daughter. She has (have) two daughters; they are my granddaughters. Sara  … (not have) much free time because she  … (work) in a shop. In the week, she  … (get up) very early and she  ",
            "after": " (go) to bed quite late every day. She  … (love) Sundays because she  … (not work) and she  … (spend) the day with her family. On Sundays, they  … (not get up) very late because they always  … (go out). My granddaughters  … (be) always sad on Sunday evenings because it's the end of the weekend.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "Sara is my daughter. She has (have) two daughters; they are my granddaughters. Sara  … (not have) much free time because she  … (work) in a shop. In the week, she  … (get up) very early and she  … (go) to bed quite late every day. She  ",
            "after": " (love) Sundays because she  … (not work) and she  … (spend) the day with her family. On Sundays, they  … (not get up) very late because they always  … (go out). My granddaughters  … (be) always sad on Sunday evenings because it's the end of the weekend.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "Sara is my daughter. She has (have) two daughters; they are my granddaughters. Sara  … (not have) much free time because she  … (work) in a shop. In the week, she  … (get up) very early and she  … (go) to bed quite late every day. She  … (love) Sundays because she  ",
            "after": " (not work) and she  … (spend) the day with her family. On Sundays, they  … (not get up) very late because they always  … (go out). My granddaughters  … (be) always sad on Sunday evenings because it's the end of the weekend.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "Sara is my daughter. She has (have) two daughters; they are my granddaughters. Sara  … (not have) much free time because she  … (work) in a shop. In the week, she  … (get up) very early and she  … (go) to bed quite late every day. She  … (love) Sundays because she  … (not work) and she  ",
            "after": " (spend) the day with her family. On Sundays, they  … (not get up) very late because they always  … (go out). My granddaughters  … (be) always sad on Sunday evenings because it's the end of the weekend.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "Sara is my daughter. She has (have) two daughters; they are my granddaughters. Sara  … (not have) much free time because she  … (work) in a shop. In the week, she  … (get up) very early and she  … (go) to bed quite late every day. She  … (love) Sundays because she  … (not work) and she  … (spend) the day with her family. On Sundays, they  ",
            "after": " (not get up) very late because they always  … (go out). My granddaughters  … (be) always sad on Sunday evenings because it's the end of the weekend.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "Sara is my daughter. She has (have) two daughters; they are my granddaughters. Sara  … (not have) much free time because she  … (work) in a shop. In the week, she  … (get up) very early and she  … (go) to bed quite late every day. She  … (love) Sundays because she  … (not work) and she  … (spend) the day with her family. On Sundays, they  … (not get up) very late because they always  ",
            "after": " (go out). My granddaughters  … (be) always sad on Sunday evenings because it's the end of the weekend.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "Sara is my daughter. She has (have) two daughters; they are my granddaughters. Sara  … (not have) much free time because she  … (work) in a shop. In the week, she  … (get up) very early and she  … (go) to bed quite late every day. She  … (love) Sundays because she  … (not work) and she  … (spend) the day with her family. On Sundays, they  … (not get up) very late because they always  … (go out). My granddaughters  ",
            "after": " (be) always sad on Sunday evenings because it's the end of the weekend.",
            "options": [],
            "kind": "text"
          }
        ],
        "passage": [
          [
            {
              "text": "Sara is my daughter. She has (have) two daughters; they are my granddaughters. Sara  "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " (not have) much free time because she  "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " (work) in a shop. In the week, she  "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " (get up) very early and she  "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " (go) to bed quite late every day. She  "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " (love) Sundays because she  "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " (not work) and she  "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " (spend) the day with her family. On Sundays, they  "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " (not get up) very late because they always  "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " (go out). My granddaughters  "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " (be) always sad on Sunday evenings because it's the end of the weekend."
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-questions",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "Questions: Word order and question words",
    "subtitle": "A1 grammar · all exercises",
    "cover": {
      "src": "/images/tests/a1-questions-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: Questions: Word order and question words"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Choose the correct questions.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": "",
            "prompt": "_____ to the gym?",
            "options": [
              "How often you go",
              "How often you do go",
              "How often do you go",
              "How often go you"
            ]
          },
          {
            "id": "q2",
            "before": "",
            "after": "",
            "prompt": "_____ ?",
            "options": [
              "What time does she get up",
              "What time she does get up",
              "What time she gets up",
              "What time gets up she"
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": "",
            "prompt": "_____ ?",
            "options": [
              "Who is the man over there",
              "Who the man over there is",
              "Who the man is over there",
              "Who over there is the man"
            ]
          },
          {
            "id": "q4",
            "before": "",
            "after": "",
            "prompt": "_____?",
            "options": [
              "Where your sister is from",
              "Where is your sister from",
              "Where from is your sister",
              "Where does your sister be from"
            ]
          },
          {
            "id": "q5",
            "before": "",
            "after": "",
            "prompt": "_____?",
            "options": [
              "He does exercise",
              "He does do exercise",
              "Do he does exercise",
              "Does he do exercise"
            ]
          },
          {
            "id": "q6",
            "before": "",
            "after": "",
            "prompt": "_____?",
            "options": [
              "Why you do want this job",
              "Why you want this job",
              "Why do you want this job",
              "Why want you this job"
            ]
          },
          {
            "id": "q7",
            "before": "",
            "after": "",
            "prompt": "_____ for breakfast?",
            "options": [
              "What they have",
              "What they do have",
              "What do they have",
              "What have they"
            ]
          },
          {
            "id": "q8",
            "before": "",
            "after": "",
            "prompt": "_____?",
            "options": [
              "When you are free",
              "When free are you",
              "When do you be free",
              "When are you free"
            ]
          },
          {
            "id": "q9",
            "before": "",
            "after": "",
            "prompt": "_____?",
            "options": [
              "How your sister is old",
              "How old is your sister",
              "How old your sister is",
              "How old does your sister be"
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": "",
            "prompt": "_____?",
            "options": [
              "Is your friend from Canada",
              "Is from Canada your friend",
              "Your friend is from Canada",
              "Does your friend be from Canada"
            ]
          }
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Complete the sentences with the correct question word.",
        "questions": [
          {
            "id": "q1",
            "before": "'",
            "after": " do you buy your vegetables?' 'In the market.'",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "'",
            "after": " is your father?' 'He's 57.'",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "'",
            "after": " are you in the library?' 'Because I have an exam and I need to study.'",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "'",
            "after": " do you have your exam?' 'Next Monday.'",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "'",
            "after": " do they have their breakfast?' 'At 7.'",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "'",
            "after": " do you call when you need help?' 'Peter.'",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "'",
            "after": " does John call you?' 'Every day.'",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "'",
            "after": " do you go to work?' 'By bus.'",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "'",
            "after": " tall is Ronny?' 'He's six feet tall.'",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "'",
            "after": " do you spend your holidays?' 'We always go to a little village near the sea.'",
            "options": [],
            "kind": "text"
          }
        ],
        "context": "what – what time – where (x2) – when – why – who – how (x2) – how old – how often EXAMPLE: ‘What do you have for breakfast?’ ‘A sandwich.’",
        "passage": [
          [
            {
              "text": "'"
            },
            {
              "questionId": "q1"
            },
            {
              "text": " do you buy your vegetables?' 'In the market.'"
            }
          ],
          [
            {
              "text": "'"
            },
            {
              "questionId": "q2"
            },
            {
              "text": " is your father?' 'He's 57.'"
            }
          ],
          [
            {
              "text": "'"
            },
            {
              "questionId": "q3"
            },
            {
              "text": " are you in the library?' 'Because I have an exam and I need to study.'"
            }
          ],
          [
            {
              "text": "'"
            },
            {
              "questionId": "q4"
            },
            {
              "text": " do you have your exam?' 'Next Monday.'"
            }
          ],
          [
            {
              "text": "'"
            },
            {
              "questionId": "q5"
            },
            {
              "text": " do they have their breakfast?' 'At 7.'"
            }
          ],
          [
            {
              "text": "'"
            },
            {
              "questionId": "q6"
            },
            {
              "text": " do you call when you need help?' 'Peter.'"
            }
          ],
          [
            {
              "text": "'"
            },
            {
              "questionId": "q7"
            },
            {
              "text": " does John call you?' 'Every day.'"
            }
          ],
          [
            {
              "text": "'"
            },
            {
              "questionId": "q8"
            },
            {
              "text": " do you go to work?' 'By bus.'"
            }
          ],
          [
            {
              "text": "'"
            },
            {
              "questionId": "q9"
            },
            {
              "text": " tall is Ronny?' 'He's six feet tall.'"
            }
          ],
          [
            {
              "text": "'"
            },
            {
              "questionId": "q10"
            },
            {
              "text": " do you spend your holidays?' 'We always go to a little village near the sea.'"
            }
          ]
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Write questions about the underlined words. We give you the question word. Underlined words are marked with ⟦ ⟧.",
        "questions": [
          {
            "id": "q1",
            "before": "She reads ⟦magazines⟧. ⇒ What ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "My birthday is ⟦on 10th April⟧. ⇒ When ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "She lives ⟦in a big house⟧. ⇒ Where ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "I study ⟦because I want to learn⟧. ⇒ Why ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "She is ⟦sometimes⟧ wrong. ⇒ How often ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "I love ⟦Christina⟧. ⇒ Who ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "I keep the money ⟦in a safe⟧.. ⇒ Where ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "I'm tired ⟦because it's very late⟧. ⇒ Why ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "My doctor is ⟦Dr Stevens⟧. ⇒ Who ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "I clean the windows ⟦with water and vinegar⟧. ⇒ How ",
            "after": "?",
            "options": [],
            "kind": "text"
          }
        ],
        "context": "EXAMPLE: We are in Scotland. ⇒ Where are you?",
        "passage": [
          [
            {
              "text": "She reads ⟦magazines⟧. ⇒ What "
            },
            {
              "questionId": "q1"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "My birthday is ⟦on 10th April⟧. ⇒ When "
            },
            {
              "questionId": "q2"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "She lives ⟦in a big house⟧. ⇒ Where "
            },
            {
              "questionId": "q3"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "I study ⟦because I want to learn⟧. ⇒ Why "
            },
            {
              "questionId": "q4"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "She is ⟦sometimes⟧ wrong. ⇒ How often "
            },
            {
              "questionId": "q5"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "I love ⟦Christina⟧. ⇒ Who "
            },
            {
              "questionId": "q6"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "I keep the money ⟦in a safe⟧.. ⇒ Where "
            },
            {
              "questionId": "q7"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "I'm tired ⟦because it's very late⟧. ⇒ Why "
            },
            {
              "questionId": "q8"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "My doctor is ⟦Dr Stevens⟧. ⇒ Who "
            },
            {
              "questionId": "q9"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "I clean the windows ⟦with water and vinegar⟧. ⇒ How "
            },
            {
              "questionId": "q10"
            },
            {
              "text": "?"
            }
          ]
        ]
      },
      {
        "id": "exercise-4",
        "number": 4,
        "instruction": "Write questions about the underlined words. In the question, use the same verb as in the original sentence. Underlined words are marked with ⟦ ⟧.",
        "questions": [
          {
            "id": "q1",
            "before": "He is ⟦sometimes⟧ late for class. ⇒ ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "I go to the mountains ⟦in summer⟧. ⇒ ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "I go ⟦to the mountains⟧ in summer. ⇒ ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "His car is ⟦red⟧. ⇒ ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "I am ⟦very tired⟧ after work. ⇒ ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "I am very tired ⟦after work⟧. ⇒ ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "Jerry is ⟦20 years old⟧. ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "He sees ⟦Sarah⟧ every weekend. ⇒ ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "He sees Sarah ⟦every weekend⟧. ⇒ ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "I call her ⟦because I love her⟧. ⇒ ",
            "after": "?",
            "options": [],
            "kind": "text"
          }
        ],
        "context": "where (x2) – when (x2) – what colour – why – who – how – how old – how often (x2) EXAMPLE: We are in Scotland. ⇒ Where are you?",
        "passage": [
          [
            {
              "text": "He is ⟦sometimes⟧ late for class. ⇒ "
            },
            {
              "questionId": "q1"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "I go to the mountains ⟦in summer⟧. ⇒ "
            },
            {
              "questionId": "q2"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "I go ⟦to the mountains⟧ in summer. ⇒ "
            },
            {
              "questionId": "q3"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "His car is ⟦red⟧. ⇒ "
            },
            {
              "questionId": "q4"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "I am ⟦very tired⟧ after work. ⇒ "
            },
            {
              "questionId": "q5"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "I am very tired ⟦after work⟧. ⇒ "
            },
            {
              "questionId": "q6"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "Jerry is ⟦20 years old⟧. "
            },
            {
              "questionId": "q7"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "He sees ⟦Sarah⟧ every weekend. ⇒ "
            },
            {
              "questionId": "q8"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "He sees Sarah ⟦every weekend⟧. ⇒ "
            },
            {
              "questionId": "q9"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "I call her ⟦because I love her⟧. ⇒ "
            },
            {
              "questionId": "q10"
            },
            {
              "text": "?"
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-adverbs-frequency",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "Adverbs of frequency with present simple",
    "subtitle": "A1 grammar · all exercises",
    "cover": {
      "src": "/images/tests/a1-adverbs-frequency-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: Adverbs of frequency with present simple"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Order the following sentences, which contain adverbs of frequency.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": "",
            "prompt": "Which sentence is correct?",
            "options": [
              "Our teacher is often late.",
              "Our teacher often is late.",
              "Is often our teacher late?",
              "Often our teacher is late."
            ]
          },
          {
            "id": "q2",
            "before": "",
            "after": "",
            "prompt": "Which sentence is correct?",
            "options": [
              "Never we eat fast food.",
              "We eat never fast food.",
              "We eat fast food never.",
              "We never eat fast food."
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": "",
            "prompt": "Which sentence is correct?",
            "options": [
              "My father doesn't hardly ever watch football on TV.",
              "My father watches hardly ever football on TV.",
              "My father watches football on TV hardly ever.",
              "My father hardly ever watches football on TV."
            ]
          },
          {
            "id": "q4",
            "before": "",
            "after": "",
            "prompt": "Which sentence is correct?",
            "options": [
              "Do often you go to the cinema?",
              "Do you often go to the cinema?",
              "Do you go often to the cinema?",
              "Do you go to the cinema often?"
            ]
          },
          {
            "id": "q5",
            "before": "",
            "after": "",
            "prompt": "Which sentence is correct?",
            "options": [
              "He usually doesn't go to bed late.",
              "He doesn't go to bed late usually.",
              "He doesn't usually go to bed late.",
              "Does he go usually late to bed?"
            ]
          },
          {
            "id": "q6",
            "before": "",
            "after": "",
            "prompt": "Which sentence is correct?",
            "options": [
              "I every week have piano lessons.",
              "I have every week piano lessons.",
              "I have piano lessons every week."
            ]
          },
          {
            "id": "q7",
            "before": "",
            "after": "",
            "prompt": "Which sentence is correct?",
            "options": [
              "They always are very tired after the match.",
              "They are always very tired after the match.",
              "They are very tired after the match always.",
              "Always they are very tired after the match."
            ]
          },
          {
            "id": "q8",
            "before": "",
            "after": "",
            "prompt": "Which sentence is correct?",
            "options": [
              "We always have breakfast at home.",
              "Always we have breakfast at home.",
              "We have always breakfast at home.",
              "We have breakfast at home always."
            ]
          },
          {
            "id": "q9",
            "before": "",
            "after": "",
            "prompt": "Which sentence is correct?",
            "options": [
              "She doesn't wear jeans often.",
              "She often doesn't wear jeans.",
              "Often she doesn't wear jeans.",
              "She doesn't often wear jeans."
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": "",
            "prompt": "Which sentence is correct?",
            "options": [
              "Are you sometimes tired at the end of the class?",
              "Are sometimes you tired at the end of the class?",
              "Are you tired sometimes at the end of the class?",
              "You are sometimes tired at the end of the class?"
            ]
          }
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Choose the correct options to complete the sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": "",
            "prompt": "Tom _____ to the radio.",
            "options": [
              "never listens",
              "doesn't never listen",
              "never doesn't listen"
            ]
          },
          {
            "id": "q2",
            "before": "",
            "after": "",
            "prompt": "_____ in class on time?",
            "options": [
              "Is always your teacher",
              "Is your teacher always",
              "Always is your teacher"
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": "",
            "prompt": "He _____ his homework.",
            "options": [
              "hardly ever doesn't do",
              "doesn't hardly ever do",
              "hardly ever does"
            ]
          },
          {
            "id": "q4",
            "before": "",
            "after": "",
            "prompt": "He _____ to class.",
            "options": [
              "doesn't always go",
              "always doesn't go",
              "doesn't go always"
            ]
          },
          {
            "id": "q5",
            "before": "",
            "after": "",
            "prompt": "Alice and Tom _____.",
            "options": [
              "cook every day dinner",
              "every day cook diner",
              "cook dinner every day"
            ]
          },
          {
            "id": "q6",
            "before": "",
            "after": "",
            "prompt": "She _____ during dinner.",
            "options": [
              "has hardly ever wine",
              "hardly ever has wine",
              "has wine hardly ever"
            ]
          },
          {
            "id": "q7",
            "before": "",
            "after": "",
            "prompt": "What time _____ at the weekend?",
            "options": [
              "do you usually get up",
              "usually do you get up",
              "usually you get up"
            ]
          },
          {
            "id": "q8",
            "before": "",
            "after": "",
            "prompt": "We _____ our mistakes.",
            "options": [
              "don't often admit",
              "often don't admit",
              "don't admit often"
            ]
          },
          {
            "id": "q9",
            "before": "",
            "after": "",
            "prompt": "Mark _____.",
            "options": [
              "always is busy",
              "is busy always",
              "is always busy"
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": "",
            "prompt": "My brother _____.",
            "options": [
              "reads comics sometimes",
              "sometimes reads comics",
              "reads sometimes comics"
            ]
          }
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Rewrite the sentences using the adverbs of frequency or the expressions of frequency in the correct position.",
        "questions": [
          {
            "id": "q1",
            "before": "She has a shower in the morning. (always) ⇒ She ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "Where do you go running? (usually) ⇒ Where ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "She is full of energy. (always) ⇒ She ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "My parents approve of my friends. (hardly ever) ⇒ My parents ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "I listen to the radio. (every night) ⇒ I ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "He is strict with his students. (sometimes) ⇒ He ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "I don't ask for help when I need it. (usually) ⇒ I ",
            "after": " when I need it.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "He is late for school. (never) ⇒ He ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "You make mistakes. (often) ⇒ You ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "I meditate. (usually/twice a day) ⇒ I ",
            "after": ".",
            "options": [],
            "kind": "text"
          }
        ],
        "passage": [
          [
            {
              "text": "She has a shower in the morning. (always) ⇒ She "
            },
            {
              "questionId": "q1"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "Where do you go running? (usually) ⇒ Where "
            },
            {
              "questionId": "q2"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "She is full of energy. (always) ⇒ She "
            },
            {
              "questionId": "q3"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "My parents approve of my friends. (hardly ever) ⇒ My parents "
            },
            {
              "questionId": "q4"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "I listen to the radio. (every night) ⇒ I "
            },
            {
              "questionId": "q5"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "He is strict with his students. (sometimes) ⇒ He "
            },
            {
              "questionId": "q6"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "I don't ask for help when I need it. (usually) ⇒ I "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " when I need it."
            }
          ],
          [
            {
              "text": "He is late for school. (never) ⇒ He "
            },
            {
              "questionId": "q8"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "You make mistakes. (often) ⇒ You "
            },
            {
              "questionId": "q9"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "I meditate. (usually/twice a day) ⇒ I "
            },
            {
              "questionId": "q10"
            },
            {
              "text": "."
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-object-pronouns",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "Object pronouns vs subject pronouns: Me or I, she or her?",
    "subtitle": "A1 grammar · all exercises",
    "cover": {
      "src": "/images/tests/a1-object-pronouns-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: Object pronouns vs subject pronouns: Me or I, she or her?"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Choose the correct subject pronouns or object pronouns to complete the following sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "What time can I call ",
            "after": "?",
            "options": [
              "him",
              "he"
            ]
          },
          {
            "id": "q2",
            "before": "",
            "after": " never listens to ….",
            "options": [
              "Him",
              "He"
            ]
          },
          {
            "id": "q3",
            "before": "… never listens to ",
            "after": ".",
            "options": [
              "we",
              "us"
            ]
          },
          {
            "id": "q4",
            "before": "'Do you like my new glasses?' 'Yes, ",
            "after": " love ….",
            "options": [
              "I",
              "me"
            ]
          },
          {
            "id": "q5",
            "before": "'Do you like my new glasses?' 'Yes, … love ",
            "after": ".",
            "options": [
              "they",
              "it",
              "them"
            ]
          },
          {
            "id": "q6",
            "before": "Tom loves his rabbits. ",
            "after": " plays with … in the garden every day.",
            "options": [
              "Him",
              "He"
            ]
          },
          {
            "id": "q7",
            "before": "Tom loves his rabbits. … plays with ",
            "after": " in the garden every day.",
            "options": [
              "they",
              "them"
            ]
          },
          {
            "id": "q8",
            "before": "Please, call ",
            "after": " soon; … am very worried.",
            "options": [
              "me",
              "I"
            ]
          },
          {
            "id": "q9",
            "before": "Please, call … soon; ",
            "after": " am very worried.",
            "options": [
              "me",
              "I"
            ]
          },
          {
            "id": "q10",
            "before": "Look, Sara and Kevin. Can you see ",
            "after": "?",
            "options": [
              "they",
              "them",
              "you"
            ]
          },
          {
            "id": "q11",
            "before": "Tell John that ",
            "after": " can meet … at the canteen.",
            "options": [
              "him",
              "he",
              "she"
            ]
          },
          {
            "id": "q12",
            "before": "Tell John that … can meet ",
            "after": " at the canteen.",
            "options": [
              "we",
              "they",
              "us"
            ]
          },
          {
            "id": "q13",
            "before": "I like your earrings. Can ",
            "after": " see …?",
            "options": [
              "I",
              "me"
            ]
          },
          {
            "id": "q14",
            "before": "I like your earrings. Can … see ",
            "after": "?",
            "options": [
              "them",
              "they"
            ]
          },
          {
            "id": "q15",
            "before": "Look at that man. Who is ",
            "after": "?",
            "options": [
              "he",
              "him"
            ]
          },
          {
            "id": "q16",
            "before": "That man over there is David. I work with ",
            "after": ".",
            "options": [
              "him",
              "he",
              "her"
            ]
          }
        ],
        "passage": [
          [
            {
              "text": "What time can I call "
            },
            {
              "questionId": "q1"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "questionId": "q2"
            },
            {
              "text": " never listens to "
            },
            {
              "questionId": "q3"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "'Do you like my new glasses?' 'Yes, "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " love "
            },
            {
              "questionId": "q5"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "Tom loves his rabbits. "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " plays with "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " in the garden every day."
            }
          ],
          [
            {
              "text": "Please, call "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " soon; "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " am very worried."
            }
          ],
          [
            {
              "text": "Look, Sara and Kevin. Can you see "
            },
            {
              "questionId": "q10"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "Tell John that "
            },
            {
              "questionId": "q11"
            },
            {
              "text": " can meet "
            },
            {
              "questionId": "q12"
            },
            {
              "text": " at the canteen."
            }
          ],
          [
            {
              "text": "I like your earrings. Can "
            },
            {
              "questionId": "q13"
            },
            {
              "text": " see "
            },
            {
              "questionId": "q14"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "Look at that man. Who is "
            },
            {
              "questionId": "q15"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "That man over there is David. I work with "
            },
            {
              "questionId": "q16"
            },
            {
              "text": "."
            }
          ]
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Replace the underlined words with the correct subject pronouns or object pronouns. Underlined words are marked with ⟦ ⟧.",
        "questions": [
          {
            "id": "q1",
            "before": "I can't find ⟦my keys⟧. ⇒ I can't find ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "⟦Rachel⟧ helps ⟦the students⟧. ⇒ ",
            "after": " helps ….",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "⟦Rachel⟧ helps ⟦the students⟧. ⇒ … helps ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "I need to tell ⟦John⟧ the truth. ⇒ I need to tell ",
            "after": " the truth.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "⟦My dad and I⟧ love ⟦chocolate⟧. ⇒ ",
            "after": " love ….",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "⟦My dad and I⟧ love ⟦chocolate⟧. ⇒ … love ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "⟦Suzan and Tom⟧ call ⟦their daughter⟧ every day. ⇒ ",
            "after": " call … every day.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "⟦Suzan and Tom⟧ call ⟦their daughter⟧ every day. ⇒ … call ",
            "after": " every day.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "I like cooking ⟦for my children⟧. ⇒ I like cooking for ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "Give ⟦the documents⟧ to ⟦Carmen⟧. ⇒ Give ",
            "after": " to ….",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q11",
            "before": "Give ⟦the documents⟧ to ⟦Carmen⟧. ⇒ Give … to ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q12",
            "before": "⟦Tom⟧ often plays football with ⟦my friends and me ⟧. ⇒ ",
            "after": " often plays football with ….",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q13",
            "before": "⟦Tom⟧ often plays football with ⟦my friends and me ⟧. ⇒ … often plays football with ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q14",
            "before": "How old is ⟦Emma⟧? ⇒ How old is ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q15",
            "before": "I need ⟦the scissors⟧ to cut ⟦the paper⟧. ⇒ I need ",
            "after": " to cut ….",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q16",
            "before": "I need ⟦the scissors⟧ to cut ⟦the paper⟧. ⇒ I need … to cut ",
            "after": ".",
            "options": [],
            "kind": "text"
          }
        ],
        "passage": [
          [
            {
              "text": "I can't find ⟦my keys⟧. ⇒ I can't find "
            },
            {
              "questionId": "q1"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "⟦Rachel⟧ helps ⟦the students⟧. ⇒ "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " helps "
            },
            {
              "questionId": "q3"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "I need to tell ⟦John⟧ the truth. ⇒ I need to tell "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " the truth."
            }
          ],
          [
            {
              "text": "⟦My dad and I⟧ love ⟦chocolate⟧. ⇒ "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " love "
            },
            {
              "questionId": "q6"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "⟦Suzan and Tom⟧ call ⟦their daughter⟧ every day. ⇒ "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " call "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " every day."
            }
          ],
          [
            {
              "text": "I like cooking ⟦for my children⟧. ⇒ I like cooking for "
            },
            {
              "questionId": "q9"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "Give ⟦the documents⟧ to ⟦Carmen⟧. ⇒ Give "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " to "
            },
            {
              "questionId": "q11"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "⟦Tom⟧ often plays football with ⟦my friends and me ⟧. ⇒ "
            },
            {
              "questionId": "q12"
            },
            {
              "text": " often plays football with "
            },
            {
              "questionId": "q13"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "How old is ⟦Emma⟧? ⇒ How old is "
            },
            {
              "questionId": "q14"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "I need ⟦the scissors⟧ to cut ⟦the paper⟧. ⇒ I need "
            },
            {
              "questionId": "q15"
            },
            {
              "text": " to cut "
            },
            {
              "questionId": "q16"
            },
            {
              "text": "."
            }
          ]
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Complete the sentences using the correct subject pronouns or object pronouns.",
        "questions": [
          {
            "id": "q1",
            "before": "I'm not dangerous. Don't be afraid of ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "I don't like this music; ",
            "after": " is boring. Can you stop …?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "I don't like this music; … is boring. Can you stop ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "That's my money. Can you give ",
            "after": " to …? I need it.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "That's my money. Can you give … to ",
            "after": "? I need it.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "Susan is in trouble and ",
            "after": " needs help. We have to help ….",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "Susan is in trouble and … needs help. We have to help ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "Jack is very special. I think I'm in love with ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "We are going to the cinema. Do you want to come with ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "I don't want to eat this cheese. ",
            "after": " smells horrible.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q11",
            "before": "Don't eat cookies. ",
            "after": " are very unhealthy.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q12",
            "before": "I can't find Sally. Where is ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q13",
            "before": "",
            "after": " need help. Can you help us?",
            "options": [],
            "kind": "text"
          }
        ],
        "passage": [
          [
            {
              "text": "I'm not dangerous. Don't be afraid of "
            },
            {
              "questionId": "q1"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "I don't like this music; "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " is boring. Can you stop "
            },
            {
              "questionId": "q3"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "That's my money. Can you give "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " to "
            },
            {
              "questionId": "q5"
            },
            {
              "text": "? I need it."
            }
          ],
          [
            {
              "text": "Susan is in trouble and "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " needs help. We have to help "
            },
            {
              "questionId": "q7"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "Jack is very special. I think I'm in love with "
            },
            {
              "questionId": "q8"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "We are going to the cinema. Do you want to come with "
            },
            {
              "questionId": "q9"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "I don't want to eat this cheese. "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " smells horrible."
            }
          ],
          [
            {
              "text": "Don't eat cookies. "
            },
            {
              "questionId": "q11"
            },
            {
              "text": " are very unhealthy."
            }
          ],
          [
            {
              "text": "I can't find Sally. Where is "
            },
            {
              "questionId": "q12"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "questionId": "q13"
            },
            {
              "text": " need help. Can you help us?"
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-whose-possessive-s",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "Whose, possessive 's: Whose is this? It's Mike's",
    "subtitle": "A1 grammar · all exercises",
    "cover": {
      "src": "/images/tests/a1-whose-possessive-s-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: Whose, possessive 's: Whose is this? It's Mike's"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Choose the correct option to complete the sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "George is ",
            "after": ".",
            "options": [
              "my sisters' new boyfriend",
              "my sister's new boyfriend",
              "the new boyfriend of my sister"
            ]
          },
          {
            "id": "q2",
            "before": "All ",
            "after": " are broken.",
            "options": [
              "the boys' toys",
              "the boys toys",
              "the toys of the boys"
            ]
          },
          {
            "id": "q3",
            "before": "The ",
            "after": " are yellow.",
            "options": [
              "books pages",
              "pages of the book",
              "book's pages"
            ]
          },
          {
            "id": "q4",
            "before": "This is ",
            "after": ".",
            "options": [
              "Hellens house",
              "Hellen's house",
              "the house of Hellen"
            ]
          },
          {
            "id": "q5",
            "before": "This is ",
            "after": ".",
            "options": [
              "the collar of my dog",
              "my dogs collar",
              "my dog's collar"
            ]
          },
          {
            "id": "q6",
            "before": "You need to clean ",
            "after": ".",
            "options": [
              "the floor of the house",
              "the house's floor",
              "the floor's houses"
            ]
          },
          {
            "id": "q7",
            "before": "These are ",
            "after": ". (= One car belongs to Tom and another car to Jenny.)",
            "options": [
              "Tom and Jenny's cars",
              "Tom's and Jenny's cars",
              "the cars of Tom and Jenny"
            ]
          },
          {
            "id": "q8",
            "before": "This is ",
            "after": ". (=Two people have one car.)",
            "options": [
              "Tom's and Jenny's car",
              "the car of Tom and Jenny",
              "Tom and Jenny's car"
            ]
          },
          {
            "id": "q9",
            "before": "",
            "after": " helps me with my homework.",
            "options": [
              "My mums' friend",
              "The friend of my mum",
              "My mum's friend"
            ]
          },
          {
            "id": "q10",
            "before": "I need to paint ",
            "after": ".",
            "options": [
              "the playroom of the children",
              "the children's playroom",
              "the childrens' playroom"
            ]
          }
        ],
        "passage": [
          [
            {
              "text": "George is "
            },
            {
              "questionId": "q1"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "All "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " are broken."
            }
          ],
          [
            {
              "text": "The "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " are yellow."
            }
          ],
          [
            {
              "text": "This is "
            },
            {
              "questionId": "q4"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "This is "
            },
            {
              "questionId": "q5"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "You need to clean "
            },
            {
              "questionId": "q6"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "These are "
            },
            {
              "questionId": "q7"
            },
            {
              "text": ". (= One car belongs to Tom and another car to Jenny.)"
            }
          ],
          [
            {
              "text": "This is "
            },
            {
              "questionId": "q8"
            },
            {
              "text": ". (=Two people have one car.)"
            }
          ],
          [
            {
              "questionId": "q9"
            },
            {
              "text": " helps me with my homework."
            }
          ],
          [
            {
              "text": "I need to paint "
            },
            {
              "questionId": "q10"
            },
            {
              "text": "."
            }
          ]
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Choose the correct forms: whose, who’s possessive ‘s, etc.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": "",
            "prompt": "_____ picture is this?",
            "options": [
              "Whose",
              "Who's",
              "Whos"
            ]
          },
          {
            "id": "q2",
            "before": "",
            "after": "",
            "prompt": "_____ is ill.",
            "options": [
              "The father of Allan",
              "Father's Edgar",
              "Allan's father"
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": "",
            "prompt": "_____ that man at the table?",
            "options": [
              "Whos",
              "Who's",
              "Whose"
            ]
          },
          {
            "id": "q4",
            "before": "",
            "after": "",
            "prompt": "The shop is at _____.",
            "options": [
              "the end of the street",
              "the street's end",
              "the end's street"
            ]
          },
          {
            "id": "q5",
            "before": "",
            "after": "",
            "prompt": "_____ is very expensive.",
            "options": [
              "New car's Lucy",
              "Lucy's new car",
              "The new car of Lucy"
            ]
          },
          {
            "id": "q6",
            "before": "",
            "after": "",
            "prompt": "I love _____.",
            "options": [
              "the new book of Rowling",
              "the new book's Rowling",
              "Rowling's new book"
            ]
          },
          {
            "id": "q7",
            "before": "",
            "after": "",
            "prompt": "_____ is this absurd idea?",
            "options": [
              "Who's",
              "Whose",
              "Whos'"
            ]
          },
          {
            "id": "q8",
            "before": "",
            "after": "",
            "prompt": "_____ the person in the photo?",
            "options": [
              "Who's",
              "Whos'",
              "Whose"
            ]
          },
          {
            "id": "q9",
            "before": "",
            "after": "",
            "prompt": "In this school, 100% of _____ are recycled. All the students recycle their textbooks.",
            "options": [
              "the textbooks' students",
              "the students' textbooks",
              "the student's textbooks"
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": "",
            "prompt": "_____ is next Sunday.",
            "options": [
              "Sheila and Mike's wedding",
              "Sheila's and Mike's wedding",
              "the wedding of Sheila and Mike"
            ]
          }
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Rewrite the sentences using the possessive ‘s as in the example.",
        "questions": [
          {
            "id": "q1",
            "before": "The balls belong to the players. ⇒ They are ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "The computer belongs to Sara. ⇒ It's ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "I hate the moustache that belongs to my brother. ⇒ I hate ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "This car belongs to Sam and Pam. ⇒ It's ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "The money belongs to the workers. ⇒ It's ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "These bikes belong to Mike and John (one bike to each person). ⇒ They are ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "These documents belong to the women. ⇒ They are ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "This glass belongs to Mathew. ⇒ It's ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "This award belongs to the actresses. ⇒ It's ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "This suitcase belongs to Kate and David. ⇒ It's ",
            "after": ".",
            "options": [],
            "kind": "text"
          }
        ],
        "context": "EXAMPLE: The box belongs to Jane. ⇒ It’s Jane’s box.",
        "passage": [
          [
            {
              "text": "The balls belong to the players. ⇒ They are "
            },
            {
              "questionId": "q1"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "The computer belongs to Sara. ⇒ It's "
            },
            {
              "questionId": "q2"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "I hate the moustache that belongs to my brother. ⇒ I hate "
            },
            {
              "questionId": "q3"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "This car belongs to Sam and Pam. ⇒ It's "
            },
            {
              "questionId": "q4"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "The money belongs to the workers. ⇒ It's "
            },
            {
              "questionId": "q5"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "These bikes belong to Mike and John (one bike to each person). ⇒ They are "
            },
            {
              "questionId": "q6"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "These documents belong to the women. ⇒ They are "
            },
            {
              "questionId": "q7"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "This glass belongs to Mathew. ⇒ It's "
            },
            {
              "questionId": "q8"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "This award belongs to the actresses. ⇒ It's "
            },
            {
              "questionId": "q9"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "This suitcase belongs to Kate and David. ⇒ It's "
            },
            {
              "questionId": "q10"
            },
            {
              "text": "."
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-at-in-on-prepositions-time",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "At, in, on: Prepositions of time",
    "subtitle": "A1 grammar · all exercises",
    "cover": {
      "src": "/images/tests/a1-at-in-on-prepositions-time-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: At, in, on: Prepositions of time"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Choose at, in, on to complete the sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "See you ",
            "after": " Friday.",
            "options": [
              "in",
              "at",
              "on"
            ]
          },
          {
            "id": "q2",
            "before": "I brush my teeth ",
            "after": " the morning.",
            "options": [
              "at",
              "on",
              "in"
            ]
          },
          {
            "id": "q3",
            "before": "The match is ",
            "after": " 4 o'clock.",
            "options": [
              "on",
              "in",
              "at"
            ]
          },
          {
            "id": "q4",
            "before": "We have lunch ",
            "after": " midday.",
            "options": [
              "in",
              "on",
              "at"
            ]
          },
          {
            "id": "q5",
            "before": "I'm busy ",
            "after": " the moment.",
            "options": [
              "at",
              "on",
              "in"
            ]
          },
          {
            "id": "q6",
            "before": "My parents always visit me ",
            "after": " my birthday.",
            "options": [
              "at",
              "in",
              "on"
            ]
          },
          {
            "id": "q7",
            "before": "He was born ",
            "after": " the 19th century",
            "options": [
              "in",
              "on",
              "at"
            ]
          },
          {
            "id": "q8",
            "before": "He usually goes on holiday ",
            "after": " July",
            "options": [
              "in",
              "on",
              "at"
            ]
          },
          {
            "id": "q9",
            "before": "They always get together ",
            "after": " Christmas.",
            "options": [
              "at",
              "on",
              "in"
            ]
          },
          {
            "id": "q10",
            "before": "You can come ",
            "after": " the weekend.",
            "options": [
              "in",
              "at"
            ]
          }
        ],
        "passage": [
          [
            {
              "text": "See you "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " Friday."
            }
          ],
          [
            {
              "text": "I brush my teeth "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " the morning."
            }
          ],
          [
            {
              "text": "The match is "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " 4 o'clock."
            }
          ],
          [
            {
              "text": "We have lunch "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " midday."
            }
          ],
          [
            {
              "text": "I'm busy "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " the moment."
            }
          ],
          [
            {
              "text": "My parents always visit me "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " my birthday."
            }
          ],
          [
            {
              "text": "He was born "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " the 19th century"
            }
          ],
          [
            {
              "text": "He usually goes on holiday "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " July"
            }
          ],
          [
            {
              "text": "They always get together "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " Christmas."
            }
          ],
          [
            {
              "text": "You can come "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " the weekend."
            }
          ]
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Choose the correct prepositions of time (at, in, on) to complete the sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": "",
            "prompt": "I have to meet the clients _____ lunchtime.",
            "options": [
              "at",
              "in",
              "on"
            ]
          },
          {
            "id": "q2",
            "before": "",
            "after": "",
            "prompt": "This happened _____ the 80s.",
            "options": [
              "at",
              "in",
              "on"
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": "",
            "prompt": "We want to go for a drink after the concert _____ Friday evening",
            "options": [
              "at",
              "in",
              "on"
            ]
          },
          {
            "id": "q4",
            "before": "",
            "after": "",
            "prompt": "You can plant these flowers _____ the autumn.",
            "options": [
              "at",
              "in",
              "on"
            ]
          },
          {
            "id": "q5",
            "before": "",
            "after": "",
            "prompt": "Is your neighbourhood quiet _____ night?",
            "options": [
              "at",
              "in",
              "on"
            ]
          },
          {
            "id": "q6",
            "before": "",
            "after": "",
            "prompt": "I will retire _____ 2030.",
            "options": [
              "at",
              "in",
              "on"
            ]
          },
          {
            "id": "q7",
            "before": "",
            "after": "",
            "prompt": "My birthday is _____ the 10th of January.",
            "options": [
              "at",
              "in",
              "on"
            ]
          },
          {
            "id": "q8",
            "before": "",
            "after": "",
            "prompt": "I usually go to bed _____ midnight.",
            "options": [
              "at",
              "in",
              "on"
            ]
          },
          {
            "id": "q9",
            "before": "",
            "after": "",
            "prompt": "I don't work _____ Christmas day.",
            "options": [
              "at",
              "in",
              "on"
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": "",
            "prompt": "We usually stay home _____ Easter.",
            "options": [
              "at",
              "in",
              "on"
            ]
          }
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Complete the sentences using the correct prepositions of time: at, in, on.",
        "questions": [
          {
            "id": "q1",
            "before": "Fish is a healthy option ",
            "after": " dinnertime.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "The interview is ",
            "after": " 8 o'clock … Monday morning.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "The interview is … 8 o'clock ",
            "after": " Monday morning.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "The snow melts ",
            "after": " the spring.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "Every year, I visit my parents ",
            "after": " Thanksgiving Day.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "",
            "after": " summer, we go fishing … weekends.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "… summer, we go fishing ",
            "after": " weekends.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "I'm unemployed ",
            "after": " the moment.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "Classes end ",
            "after": " the 4th of July.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "We don't know what will happen ",
            "after": " the future.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q11",
            "before": "You can visit us ",
            "after": " June.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q12",
            "before": "You need to raise your hand ",
            "after": " the same time.",
            "options": [],
            "kind": "text"
          }
        ],
        "passage": [
          [
            {
              "text": "Fish is a healthy option "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " dinnertime."
            }
          ],
          [
            {
              "text": "The interview is "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " 8 o'clock "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " Monday morning."
            }
          ],
          [
            {
              "text": "The snow melts "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " the spring."
            }
          ],
          [
            {
              "text": "Every year, I visit my parents "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " Thanksgiving Day."
            }
          ],
          [
            {
              "questionId": "q6"
            },
            {
              "text": " summer, we go fishing "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " weekends."
            }
          ],
          [
            {
              "text": "I'm unemployed "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " the moment."
            }
          ],
          [
            {
              "text": "Classes end "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " the 4th of July."
            }
          ],
          [
            {
              "text": "We don't know what will happen "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " the future."
            }
          ],
          [
            {
              "text": "You can visit us "
            },
            {
              "questionId": "q11"
            },
            {
              "text": " June."
            }
          ],
          [
            {
              "text": "You need to raise your hand "
            },
            {
              "questionId": "q12"
            },
            {
              "text": " the same time."
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-at-in-on-prepositions-of-place",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "At, in, on: Prepositions of place",
    "subtitle": "A1 grammar · all exercises",
    "cover": {
      "src": "/images/tests/a1-at-in-on-prepositions-of-place-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: At, in, on: Prepositions of place"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Choose at, in, on to complete the sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "They are sitting ",
            "after": " the table.",
            "options": [
              "at",
              "on",
              "in"
            ]
          },
          {
            "id": "q2",
            "before": "I want to spend a year ",
            "after": " Barcelona.",
            "options": [
              "at",
              "on",
              "in"
            ]
          },
          {
            "id": "q3",
            "before": "The milk isn't ",
            "after": " the fridge. Where is it?",
            "options": [
              "on",
              "in",
              "at"
            ]
          },
          {
            "id": "q4",
            "before": "Is Peter's office ",
            "after": " the first or the second floor?",
            "options": [
              "at",
              "in",
              "on"
            ]
          },
          {
            "id": "q5",
            "before": "Why are all these clothes ",
            "after": " the bed?",
            "options": [
              "on",
              "in",
              "at"
            ]
          },
          {
            "id": "q6",
            "before": "Please, put the clothes ",
            "after": " the wardrobe.",
            "options": [
              "at",
              "in",
              "on"
            ]
          },
          {
            "id": "q7",
            "before": "Are you ",
            "after": " home?",
            "options": [
              "in the",
              "at the",
              "at"
            ]
          },
          {
            "id": "q8",
            "before": "I don't want to see her ",
            "after": " the party tonight.",
            "options": [
              "in",
              "at",
              "on"
            ]
          },
          {
            "id": "q9",
            "before": "I like the sea, but I prefer swimming ",
            "after": " a swimming pool.",
            "options": [
              "on",
              "in",
              "at"
            ]
          },
          {
            "id": "q10",
            "before": "Please, call me when you are ",
            "after": " the bus.",
            "options": [
              "at",
              "in",
              "on"
            ]
          }
        ],
        "passage": [
          [
            {
              "text": "They are sitting "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " the table."
            }
          ],
          [
            {
              "text": "I want to spend a year "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " Barcelona."
            }
          ],
          [
            {
              "text": "The milk isn't "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " the fridge. Where is it?"
            }
          ],
          [
            {
              "text": "Is Peter's office "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " the first or the second floor?"
            }
          ],
          [
            {
              "text": "Why are all these clothes "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " the bed?"
            }
          ],
          [
            {
              "text": "Please, put the clothes "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " the wardrobe."
            }
          ],
          [
            {
              "text": "Are you "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " home?"
            }
          ],
          [
            {
              "text": "I don't want to see her "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " the party tonight."
            }
          ],
          [
            {
              "text": "I like the sea, but I prefer swimming "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " a swimming pool."
            }
          ],
          [
            {
              "text": "Please, call me when you are "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " the bus."
            }
          ]
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Choose the correct prepositions of place (at, in, on) to complete the sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": "",
            "prompt": "The museum is _____ the end of the street.",
            "options": [
              "at",
              "in",
              "on"
            ]
          },
          {
            "id": "q2",
            "before": "",
            "after": "",
            "prompt": "I study _____ the university of Toronto.",
            "options": [
              "at",
              "in",
              "on"
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": "",
            "prompt": "This is the best film you can see _____ the cinema now.",
            "options": [
              "at",
              "in",
              "on"
            ]
          },
          {
            "id": "q4",
            "before": "",
            "after": "",
            "prompt": "'Where's Alice?' 'She's _____ the attic.'",
            "options": [
              "at",
              "in",
              "on"
            ]
          },
          {
            "id": "q5",
            "before": "",
            "after": "",
            "prompt": "People are usually nervous on their first day _____ work.",
            "options": [
              "at",
              "in",
              "on"
            ]
          },
          {
            "id": "q6",
            "before": "",
            "after": "",
            "prompt": "Can you give me the book _____ that shelf?",
            "options": [
              "at",
              "in",
              "on"
            ]
          },
          {
            "id": "q7",
            "before": "",
            "after": "",
            "prompt": "It's the second door _____ the right.",
            "options": [
              "at",
              "in",
              "on"
            ]
          },
          {
            "id": "q8",
            "before": "",
            "after": "",
            "prompt": "All the stories _____ the book are very special.",
            "options": [
              "at",
              "in",
              "on"
            ]
          },
          {
            "id": "q9",
            "before": "",
            "after": "",
            "prompt": "We were _____ Australia last summer.",
            "options": [
              "at",
              "in",
              "on"
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": "",
            "prompt": "I always read when I'm _____ the train.",
            "options": [
              "at",
              "in",
              "on"
            ]
          }
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Complete the sentences using the correct prepositions of place: at, in, on.",
        "questions": [
          {
            "id": "q1",
            "before": "I'm ",
            "after": " the greengrocer's. Do you need anything?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "You left your keys ",
            "after": " the sofa.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "My daughter keeps her money ",
            "after": " a piggy bank.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "We want to have a picnic ",
            "after": " the lake.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "Who is that man ",
            "after": " the window?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "The cookies are ",
            "after": " the jar.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "I can't sleep ",
            "after": " the bus.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "The two main bedrooms are ",
            "after": " the ground floor.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "All the people ",
            "after": " the room applauded.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "Tourism ",
            "after": " Europe is very important.",
            "options": [],
            "kind": "text"
          }
        ],
        "passage": [
          [
            {
              "text": "I'm "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " the greengrocer's. Do you need anything?"
            }
          ],
          [
            {
              "text": "You left your keys "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " the sofa."
            }
          ],
          [
            {
              "text": "My daughter keeps her money "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " a piggy bank."
            }
          ],
          [
            {
              "text": "We want to have a picnic "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " the lake."
            }
          ],
          [
            {
              "text": "Who is that man "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " the window?"
            }
          ],
          [
            {
              "text": "The cookies are "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " the jar."
            }
          ],
          [
            {
              "text": "I can't sleep "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " the bus."
            }
          ],
          [
            {
              "text": "The two main bedrooms are "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " the ground floor."
            }
          ],
          [
            {
              "text": "All the people "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " the room applauded."
            }
          ],
          [
            {
              "text": "Tourism "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " Europe is very important."
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-can-cant",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "Can, can't: Ability, possibility, permission",
    "subtitle": "A1 grammar · all exercises",
    "cover": {
      "src": "/images/tests/a1-can-cant-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: Can, can't: Ability, possibility, permission"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Choose the correct option to complete the sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": " ask you a question?",
            "options": [
              "Do I can",
              "I can",
              "Can I"
            ]
          },
          {
            "id": "q2",
            "before": "I ",
            "after": ". The music is too loud.",
            "options": [
              "can't to hear",
              "can't hear",
              "don't can hear"
            ]
          },
          {
            "id": "q3",
            "before": "'Can you play the piano?' 'Yes, I ",
            "after": ".'",
            "options": [
              "can",
              "play",
              "do"
            ]
          },
          {
            "id": "q4",
            "before": "He ",
            "after": " four languages.",
            "options": [
              "cans speak",
              "can speak",
              "can speaks"
            ]
          },
          {
            "id": "q5",
            "before": "He says that he ",
            "after": " me.",
            "options": [
              "can't to help",
              "can't helps",
              "can't help"
            ]
          },
          {
            "id": "q6",
            "before": "",
            "after": " a ham and cheese pizza, please?",
            "options": [
              "Can I have",
              "Can I to have",
              "Do I can have"
            ]
          },
          {
            "id": "q7",
            "before": "'Can I smoke here?' 'No, you ",
            "after": ".'",
            "options": [
              "aren't",
              "don't",
              "can't"
            ]
          },
          {
            "id": "q8",
            "before": "We ",
            "after": " use our phones in class.",
            "options": [
              "cannot",
              "don't can",
              "can't to"
            ]
          },
          {
            "id": "q9",
            "before": "He ",
            "after": " my car if he needs it.",
            "options": [
              "cans use",
              "can use",
              "can to use"
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": " the window, please?",
            "options": [
              "Do you can open",
              "Can you to open",
              "Can you open"
            ]
          }
        ],
        "passage": [
          [
            {
              "questionId": "q1"
            },
            {
              "text": " ask you a question?"
            }
          ],
          [
            {
              "text": "I "
            },
            {
              "questionId": "q2"
            },
            {
              "text": ". The music is too loud."
            }
          ],
          [
            {
              "text": "'Can you play the piano?' 'Yes, I "
            },
            {
              "questionId": "q3"
            },
            {
              "text": ".'"
            }
          ],
          [
            {
              "text": "He "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " four languages."
            }
          ],
          [
            {
              "text": "He says that he "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " me."
            }
          ],
          [
            {
              "questionId": "q6"
            },
            {
              "text": " a ham and cheese pizza, please?"
            }
          ],
          [
            {
              "text": "'Can I smoke here?' 'No, you "
            },
            {
              "questionId": "q7"
            },
            {
              "text": ".'"
            }
          ],
          [
            {
              "text": "We "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " use our phones in class."
            }
          ],
          [
            {
              "text": "He "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " my car if he needs it."
            }
          ],
          [
            {
              "questionId": "q10"
            },
            {
              "text": " the window, please?"
            }
          ]
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Write affirmative (+) and negative (-) sentences using can, can’t with the words below.",
        "questions": [
          {
            "id": "q1",
            "before": "She / dance / very well. ⇒ She ",
            "after": ". (+)",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "I / finish / the composition for tomorrow. ⇒ I ",
            "after": " for tomorrow. (-)",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "You / park / your car here. ⇒ You ",
            "after": " here. (-)",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "Jim / come / to the concert with us. ⇒ Jim ",
            "after": " with us. (+)",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "She / meet / you at 7. ⇒ She ",
            "after": ". (-)",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "You / use / this app to view documents. ⇒ You ",
            "after": " to view documents. (+)",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "We / lose / this match. ⇒ We ",
            "after": ". (-)",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "They / understand / my decision. ⇒ They ",
            "after": ". (-)",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "She / stay / at my house tonight. ⇒ She ",
            "after": " tonight. (+)",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "You / see / the sea from the balcony. ⇒ You ",
            "after": " from the balcony. (-)",
            "options": [],
            "kind": "text"
          }
        ],
        "passage": [
          [
            {
              "text": "She / dance / very well. ⇒ She "
            },
            {
              "questionId": "q1"
            },
            {
              "text": ". (+)"
            }
          ],
          [
            {
              "text": "I / finish / the composition for tomorrow. ⇒ I "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " for tomorrow. (-)"
            }
          ],
          [
            {
              "text": "You / park / your car here. ⇒ You "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " here. (-)"
            }
          ],
          [
            {
              "text": "Jim / come / to the concert with us. ⇒ Jim "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " with us. (+)"
            }
          ],
          [
            {
              "text": "She / meet / you at 7. ⇒ She "
            },
            {
              "questionId": "q5"
            },
            {
              "text": ". (-)"
            }
          ],
          [
            {
              "text": "You / use / this app to view documents. ⇒ You "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " to view documents. (+)"
            }
          ],
          [
            {
              "text": "We / lose / this match. ⇒ We "
            },
            {
              "questionId": "q7"
            },
            {
              "text": ". (-)"
            }
          ],
          [
            {
              "text": "They / understand / my decision. ⇒ They "
            },
            {
              "questionId": "q8"
            },
            {
              "text": ". (-)"
            }
          ],
          [
            {
              "text": "She / stay / at my house tonight. ⇒ She "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " tonight. (+)"
            }
          ],
          [
            {
              "text": "You / see / the sea from the balcony. ⇒ You "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " from the balcony. (-)"
            }
          ]
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Complete this job interview with can, can’t and the words in brackets.",
        "questions": [
          {
            "id": "q1",
            "before": "Interviewer: ",
            "after": " (you/drive)?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "Ann: Yes, I ",
            "after": ". I have a driving license and a car.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "Interviewer: ",
            "after": " (you/accept) criticism?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "Ann: I ",
            "after": " (not accept) negative criticism, but I … (accept) constructive criticism.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "Ann: I … (not accept) negative criticism, but I ",
            "after": " (accept) constructive criticism.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "Interviewer: ",
            "after": " (you/use) the Microsoft Office Suite?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "Ann: Yes, I ",
            "after": ". I have a lot of experience using Word, Excel, and PowerPoint.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "Interviewer: ",
            "after": " (speak) German or French?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "Ann: I ",
            "after": " (speak) German very well, but I … (not speak) French very fluently.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "Ann: I … (speak) German very well, but I ",
            "after": " (not speak) French very fluently.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q11",
            "before": "Interviewer: When ",
            "after": " (you/start)?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q12",
            "before": "Ann: I ",
            "after": " (be) here tomorrow morning if you want.",
            "options": [],
            "kind": "text"
          }
        ],
        "passage": [
          [
            {
              "text": "Interviewer: "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " (you/drive)?"
            }
          ],
          [
            {
              "text": "Ann: Yes, I "
            },
            {
              "questionId": "q2"
            },
            {
              "text": ". I have a driving license and a car."
            }
          ],
          [
            {
              "text": "Interviewer: "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " (you/accept) criticism?"
            }
          ],
          [
            {
              "text": "Ann: I "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " (not accept) negative criticism, but I "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " (accept) constructive criticism."
            }
          ],
          [
            {
              "text": "Interviewer: "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " (you/use) the Microsoft Office Suite?"
            }
          ],
          [
            {
              "text": "Ann: Yes, I "
            },
            {
              "questionId": "q7"
            },
            {
              "text": ". I have a lot of experience using Word, Excel, and PowerPoint."
            }
          ],
          [
            {
              "text": "Interviewer: "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " (speak) German or French?"
            }
          ],
          [
            {
              "text": "Ann: I "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " (speak) German very well, but I "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " (not speak) French very fluently."
            }
          ],
          [
            {
              "text": "Interviewer: When "
            },
            {
              "questionId": "q11"
            },
            {
              "text": " (you/start)?"
            }
          ],
          [
            {
              "text": "Ann: I "
            },
            {
              "questionId": "q12"
            },
            {
              "text": " (be) here tomorrow morning if you want."
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-present-continuous",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "Present continuous: I'm doing, I'm not doing, Are you doing?",
    "subtitle": "A1 grammar · all exercises",
    "cover": {
      "src": "/images/tests/a1-present-continuous-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: Present continuous: I'm doing, I'm not doing, Are you doing?"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Write positive or negative sentences in present continuous using the verbs in brackets. Use Use short forms when possible.",
        "questions": [
          {
            "id": "q1",
            "before": "He ",
            "after": " (save) money because he wants to buy a car.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "You ",
            "after": " (not listen) to me.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "My parents ",
            "after": " (look) for a new apartment.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "The victim ",
            "after": " (not cooperate) with the police.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "We ",
            "after": " (plan) a trip to Japan.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "I ",
            "after": " (cook) fish for dinner.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "The water ",
            "after": " (boil). You can put the pasta now.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "He ",
            "after": " (not train) because he has health problems.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "I ",
            "after": " (not work) at present. I'm unemployed.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "It ",
            "after": " (not rain) now. We can go to the park.",
            "options": [],
            "kind": "text"
          }
        ],
        "passage": [
          [
            {
              "text": "He "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " (save) money because he wants to buy a car."
            }
          ],
          [
            {
              "text": "You "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " (not listen) to me."
            }
          ],
          [
            {
              "text": "My parents "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " (look) for a new apartment."
            }
          ],
          [
            {
              "text": "The victim "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " (not cooperate) with the police."
            }
          ],
          [
            {
              "text": "We "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " (plan) a trip to Japan."
            }
          ],
          [
            {
              "text": "I "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " (cook) fish for dinner."
            }
          ],
          [
            {
              "text": "The water "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " (boil). You can put the pasta now."
            }
          ],
          [
            {
              "text": "He "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " (not train) because he has health problems."
            }
          ],
          [
            {
              "text": "I "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " (not work) at present. I'm unemployed."
            }
          ],
          [
            {
              "text": "It "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " (not rain) now. We can go to the park."
            }
          ]
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Write questions and short answers in present continuous with the words in brackets. Use Use short forms when possible.",
        "questions": [
          {
            "id": "q1",
            "before": "A: ",
            "after": " (you/cry)?\nB: No, I ….",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "A: … (you/cry)?\nB: No, I ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "A: ",
            "after": " (your father/recover) well after the operation?\nB: Yes, he ….",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "A: … (your father/recover) well after the operation?\nB: Yes, he ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "A: ",
            "after": " (they/try) to find a solution?\nB: Yes, they ….",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "A: … (they/try) to find a solution?\nB: Yes, they ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "A: ",
            "after": " (the baby/sleep)?\nB: No, she ….",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "A: … (the baby/sleep)?\nB: No, she ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "A: ",
            "after": " (we/do) the right thing?\nB: Yes, we ….",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "A: … (we/do) the right thing?\nB: Yes, we ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q11",
            "before": "A: ",
            "after": " (he/study) for his exams?\nB: No, he ….",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q12",
            "before": "A: … (he/study) for his exams?\nB: No, he ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q13",
            "before": "A: ",
            "after": " (you eat) my pizza?\nB: Yes, I ….",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q14",
            "before": "A: … (you eat) my pizza?\nB: Yes, I ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q15",
            "before": "A: ",
            "after": " (you/pay) by credit card?\nB: No, I ….",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q16",
            "before": "A: … (you/pay) by credit card?\nB: No, I ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q17",
            "before": "A: ",
            "after": " (they/win) the match?\nB: Yes, they ….",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q18",
            "before": "A: … (they/win) the match?\nB: Yes, they ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q19",
            "before": "A: ",
            "after": " (Tom/run) in the race?\nB: No, he …. He's here with me.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q20",
            "before": "A: … (Tom/run) in the race?\nB: No, he ",
            "after": ". He's here with me.",
            "options": [],
            "kind": "text"
          }
        ],
        "passage": [
          [
            {
              "text": "A: "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " (you/cry)?\nB: No, I "
            },
            {
              "questionId": "q2"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "A: "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " (your father/recover) well after the operation?\nB: Yes, he "
            },
            {
              "questionId": "q4"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "A: "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " (they/try) to find a solution?\nB: Yes, they "
            },
            {
              "questionId": "q6"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "A: "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " (the baby/sleep)?\nB: No, she "
            },
            {
              "questionId": "q8"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "A: "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " (we/do) the right thing?\nB: Yes, we "
            },
            {
              "questionId": "q10"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "A: "
            },
            {
              "questionId": "q11"
            },
            {
              "text": " (he/study) for his exams?\nB: No, he "
            },
            {
              "questionId": "q12"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "A: "
            },
            {
              "questionId": "q13"
            },
            {
              "text": " (you eat) my pizza?\nB: Yes, I "
            },
            {
              "questionId": "q14"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "A: "
            },
            {
              "questionId": "q15"
            },
            {
              "text": " (you/pay) by credit card?\nB: No, I "
            },
            {
              "questionId": "q16"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "A: "
            },
            {
              "questionId": "q17"
            },
            {
              "text": " (they/win) the match?\nB: Yes, they "
            },
            {
              "questionId": "q18"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "A: "
            },
            {
              "questionId": "q19"
            },
            {
              "text": " (Tom/run) in the race?\nB: No, he "
            },
            {
              "questionId": "q20"
            },
            {
              "text": ". He's here with me."
            }
          ]
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Complete the dialogues with the verbs in brackets in present continuous. Use short forms when possible.",
        "questions": [
          {
            "id": "q1",
            "before": "Suzan: Hi Mark. What ",
            "after": " (you/do)?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "Mark: I ",
            "after": " (watch) TV.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "Suzan: What ",
            "after": " (you/watch)?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "Mark: A football match. Liverpool ",
            "after": " (play) against Manchester United.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "Suzan: ",
            "after": " (you/enjoy) it?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "Mark: Yes, I ",
            "after": ". It's a great match.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "Suzan: ",
            "after": " (your team/win)?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "Mark: Yes! But what about you? What ",
            "after": " (you/do)?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "Suzan: I'm with Alice. We ",
            "after": " (study) for our maths exam.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "Mark: Well, I'm sure you ",
            "after": " (not enjoy) maths. Do you want to take a break and come to my house?",
            "options": [],
            "kind": "text"
          }
        ],
        "passage": [
          [
            {
              "text": "Suzan: Hi Mark. What "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " (you/do)?"
            }
          ],
          [
            {
              "text": "Mark: I "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " (watch) TV."
            }
          ],
          [
            {
              "text": "Suzan: What "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " (you/watch)?"
            }
          ],
          [
            {
              "text": "Mark: A football match. Liverpool "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " (play) against Manchester United."
            }
          ],
          [
            {
              "text": "Suzan: "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " (you/enjoy) it?"
            }
          ],
          [
            {
              "text": "Mark: Yes, I "
            },
            {
              "questionId": "q6"
            },
            {
              "text": ". It's a great match."
            }
          ],
          [
            {
              "text": "Suzan: "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " (your team/win)?"
            }
          ],
          [
            {
              "text": "Mark: Yes! But what about you? What "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " (you/do)?"
            }
          ],
          [
            {
              "text": "Suzan: I'm with Alice. We "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " (study) for our maths exam."
            }
          ],
          [
            {
              "text": "Mark: Well, I'm sure you "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " (not enjoy) maths. Do you want to take a break and come to my house?"
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-present-simple-present-continuous",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "Present simple or present continuous?",
    "subtitle": "A1 grammar · all exercises",
    "cover": {
      "src": "/images/tests/a1-present-simple-present-continuous-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: Present simple or present continuous?"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Choose the correct present simple or present continuous form to complete the dialogues below.",
        "questions": [
          {
            "id": "q1",
            "before": "Cindy: What ",
            "after": "?",
            "options": [
              "do you do",
              "are you doing",
              "you are doing"
            ]
          },
          {
            "id": "q2",
            "before": "Robert: I'm listening to the radio. They ",
            "after": " about football.",
            "options": [
              "talk",
              "talking",
              "are talking"
            ]
          },
          {
            "id": "q3",
            "before": "Cindy: ",
            "after": " to the radio?",
            "options": [
              "Do you often listen",
              "Do you listen often",
              "Are you often listening"
            ]
          },
          {
            "id": "q4",
            "before": "Robert: Yes. I ",
            "after": " the radio.",
            "options": [
              "'m liking",
              "like",
              "'m like"
            ]
          },
          {
            "id": "q5",
            "before": "Cindy: ",
            "after": " to sports programmes?",
            "options": [
              "Are you often listening",
              "Do you often listen",
              "Do you listen often"
            ]
          },
          {
            "id": "q6",
            "before": "Robert: Not usually, but today I ",
            "after": " to know what they say about my team.",
            "options": [
              "'m wanting",
              "'m want",
              "want"
            ]
          },
          {
            "id": "q7",
            "before": "Terry: What ",
            "after": "?",
            "options": [
              "do you do",
              "are you doing",
              "are you do"
            ]
          },
          {
            "id": "q8",
            "before": "Lisa: I'm an architect, but I ",
            "after": " at the moment.",
            "options": [
              "don't work",
              "'m not work",
              "'m not working"
            ]
          },
          {
            "id": "q9",
            "before": "Terry: ",
            "after": " for a job?",
            "options": [
              "Are you looking",
              "Do you looking",
              "Do you look"
            ]
          },
          {
            "id": "q10",
            "before": "Lisa: Yes. I ",
            "after": " to find a job soon.",
            "options": [
              "'m needing",
              "'m need",
              "need"
            ]
          }
        ],
        "passage": [
          [
            {
              "text": "Cindy: What "
            },
            {
              "questionId": "q1"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "Robert: I'm listening to the radio. They "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " about football."
            }
          ],
          [
            {
              "text": "Cindy: "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " to the radio?"
            }
          ],
          [
            {
              "text": "Robert: Yes. I "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " the radio."
            }
          ],
          [
            {
              "text": "Cindy: "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " to sports programmes?"
            }
          ],
          [
            {
              "text": "Robert: Not usually, but today I "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " to know what they say about my team."
            }
          ],
          [
            {
              "text": "Terry: What "
            },
            {
              "questionId": "q7"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "Lisa: I'm an architect, but I "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " at the moment."
            }
          ],
          [
            {
              "text": "Terry: "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " for a job?"
            }
          ],
          [
            {
              "text": "Lisa: Yes. I "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " to find a job soon."
            }
          ]
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Complete the following sentences choosing the correct present simple or present continuous forms.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": "",
            "prompt": "You can take the newspaper. I _____ it.",
            "options": [
              "'m not reading",
              "don't read",
              "'m not read"
            ]
          },
          {
            "id": "q2",
            "before": "",
            "after": "",
            "prompt": "I _____ to work by car, but today I'm going by bus.",
            "options": [
              "usually go",
              "'m usually going",
              "usually going"
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": "",
            "prompt": "'Where is John?' 'He _____ a shower.'",
            "options": [
              "has",
              "having",
              "'s having"
            ]
          },
          {
            "id": "q4",
            "before": "",
            "after": "",
            "prompt": "I _____ exercise very often.",
            "options": [
              "'m not doing",
              "don't do",
              "'m not do"
            ]
          },
          {
            "id": "q5",
            "before": "",
            "after": "",
            "prompt": "Can you hear that? Our neighbours _____.",
            "options": [
              "argue",
              "arguing",
              "are arguing"
            ]
          },
          {
            "id": "q6",
            "before": "",
            "after": "",
            "prompt": "Our neighbours _____ almost every day.",
            "options": [
              "argue",
              "do argue",
              "are arguing"
            ]
          },
          {
            "id": "q7",
            "before": "",
            "after": "",
            "prompt": "What time _____ work on Fridays?",
            "options": [
              "is she start",
              "does she start",
              "is she starting"
            ]
          },
          {
            "id": "q8",
            "before": "",
            "after": "",
            "prompt": "I'm hungry. I _____ to eat something.",
            "options": [
              "'m wanting",
              "'m want",
              "want"
            ]
          },
          {
            "id": "q9",
            "before": "",
            "after": "",
            "prompt": "'Where is Jane?' 'In the living room. She___________ a movie.'",
            "options": [
              "'s watching",
              "watching",
              "watches"
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": "",
            "prompt": "I _____________ TV when I'm having dinner.",
            "options": [
              "'m never watching",
              "never watch",
              "'m never watch"
            ]
          }
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Complete the following postcard with the verbs in brackets in present simple or present continuous.",
        "questions": [
          {
            "id": "q1",
            "before": "I  ",
            "after": " (write) from New York. This is my second year here. Can you believe it? Right now I  … (sit) in a coffee shop in Manhattan. Lots of business people  … (walk) fast in the street, and lots of tourists  … (look) at the amazing buildings around them.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "I  … (write) from New York. This is my second year here. Can you believe it? Right now I  ",
            "after": " (sit) in a coffee shop in Manhattan. Lots of business people  … (walk) fast in the street, and lots of tourists  … (look) at the amazing buildings around them.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "I  … (write) from New York. This is my second year here. Can you believe it? Right now I  … (sit) in a coffee shop in Manhattan. Lots of business people  ",
            "after": " (walk) fast in the street, and lots of tourists  … (look) at the amazing buildings around them.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "I  … (write) from New York. This is my second year here. Can you believe it? Right now I  … (sit) in a coffee shop in Manhattan. Lots of business people  … (walk) fast in the street, and lots of tourists  ",
            "after": " (look) at the amazing buildings around them.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "This is a great city. Every morning, I  ",
            "after": " (get up) early and I  … (go) for a run in Central Park. Then I  … (have) some coffee and bagels before going to work. Now I  … (have) a cappuccino and a bagel in a Starbucks near my office. I  … (love) my job, and I'm happy because my business  … (expand) very quickly.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "This is a great city. Every morning, I  … (get up) early and I  ",
            "after": " (go) for a run in Central Park. Then I  … (have) some coffee and bagels before going to work. Now I  … (have) a cappuccino and a bagel in a Starbucks near my office. I  … (love) my job, and I'm happy because my business  … (expand) very quickly.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "This is a great city. Every morning, I  … (get up) early and I  … (go) for a run in Central Park. Then I  ",
            "after": " (have) some coffee and bagels before going to work. Now I  … (have) a cappuccino and a bagel in a Starbucks near my office. I  … (love) my job, and I'm happy because my business  … (expand) very quickly.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "This is a great city. Every morning, I  … (get up) early and I  … (go) for a run in Central Park. Then I  … (have) some coffee and bagels before going to work. Now I  ",
            "after": " (have) a cappuccino and a bagel in a Starbucks near my office. I  … (love) my job, and I'm happy because my business  … (expand) very quickly.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "This is a great city. Every morning, I  … (get up) early and I  … (go) for a run in Central Park. Then I  … (have) some coffee and bagels before going to work. Now I  … (have) a cappuccino and a bagel in a Starbucks near my office. I  ",
            "after": " (love) my job, and I'm happy because my business  … (expand) very quickly.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "This is a great city. Every morning, I  … (get up) early and I  … (go) for a run in Central Park. Then I  … (have) some coffee and bagels before going to work. Now I  … (have) a cappuccino and a bagel in a Starbucks near my office. I  … (love) my job, and I'm happy because my business  ",
            "after": " (expand) very quickly.",
            "options": [],
            "kind": "text"
          }
        ],
        "passage": [
          [
            {
              "text": "Dear Kate,"
            }
          ],
          [
            {
              "text": "I  "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " (write) from New York. This is my second year here. Can you believe it? Right now I  "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " (sit) in a coffee shop in Manhattan. Lots of business people  "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " (walk) fast in the street, and lots of tourists  "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " (look) at the amazing buildings around them."
            }
          ],
          [
            {
              "text": "This is a great city. Every morning, I  "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " (get up) early and I  "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " (go) for a run in Central Park. Then I  "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " (have) some coffee and bagels before going to work. Now I  "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " (have) a cappuccino and a bagel in a Starbucks near my office. I  "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " (love) my job, and I'm happy because my business  "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " (expand) very quickly."
            }
          ],
          [
            {
              "text": "I hope to see you soon."
            }
          ],
          [
            {
              "text": "Take care,"
            }
          ],
          [
            {
              "text": "Sally."
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-imperative-sit-dont-talk",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "The imperative: Sit down! Don’t talk!",
    "subtitle": "A1 grammar · all exercises",
    "cover": {
      "src": "/images/tests/a1-imperative-sit-dont-talk-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: The imperative: Sit down! Don’t talk!"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Read the numbered situations and complete the sentences using positive or negative imperatives. Use the verbs in the word bank.",
        "questions": [
          {
            "id": "q1",
            "before": "Please, ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "",
            "after": " in this area.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "",
            "after": " your mobile phone.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "",
            "after": " right.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "Please, ",
            "after": " in this area.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "",
            "after": " your name here.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "",
            "after": " careful. The floor is wet.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "",
            "after": " your hands.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "",
            "after": " slowly.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "",
            "after": " this water.",
            "options": [],
            "kind": "text"
          }
        ],
        "context": "be – drink – drive – fish – smoke – stop – talk – turn – turn off – wash – write EXAMPLE: Stop the car.\n\nAccessible text adaptation of the unavailable sign illustration:\n1. A quiet area: talking is prohibited.\n2. Fishing is prohibited here.\n3. All mobile phones must be switched off.\n4. Follow the arrow pointing right.\n5. Smoking is prohibited here.\n6. Put your name on this form.\n7. Warning: wet floor.\n8. Hands must be cleaned before entering.\n9. Slow speed required.\n10. This water is not safe to drink.",
        "passage": [
          [
            {
              "text": "Please, "
            },
            {
              "questionId": "q1"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "questionId": "q2"
            },
            {
              "text": " in this area."
            }
          ],
          [
            {
              "questionId": "q3"
            },
            {
              "text": " your mobile phone."
            }
          ],
          [
            {
              "questionId": "q4"
            },
            {
              "text": " right."
            }
          ],
          [
            {
              "text": "Please, "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " in this area."
            }
          ],
          [
            {
              "questionId": "q6"
            },
            {
              "text": " your name here."
            }
          ],
          [
            {
              "questionId": "q7"
            },
            {
              "text": " careful. The floor is wet."
            }
          ],
          [
            {
              "questionId": "q8"
            },
            {
              "text": " your hands."
            }
          ],
          [
            {
              "questionId": "q9"
            },
            {
              "text": " slowly."
            }
          ],
          [
            {
              "questionId": "q10"
            },
            {
              "text": " this water."
            }
          ]
        ],
        "images": [
          {
            "src": "/images/tests/a1-exercises/a1-imperative-sit-dont-talk-1-stop.png",
            "alt": "Traffic light showing red and amber lights for A1 grammar exercise on the imperative",
            "width": 75,
            "height": 75
          }
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Choose the correct forms to complete the following sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": "",
            "prompt": "_____ to the cinema. There is a good film today.",
            "options": [
              "You go",
              "Don't go",
              "Let's go"
            ]
          },
          {
            "id": "q2",
            "before": "",
            "after": "",
            "prompt": "_____ candy. It's bad for your teeth.",
            "options": [
              "You don't eat",
              "Let's eat",
              "Don't eat"
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": "",
            "prompt": "_____ to the party. I'm very tired and I want to go to bed.",
            "options": [
              "Let's don't go",
              "You don't go",
              "Let's not go"
            ]
          },
          {
            "id": "q4",
            "before": "",
            "after": "",
            "prompt": "_____ here, please.",
            "options": [
              "Come",
              "You come",
              "Let's come"
            ]
          },
          {
            "id": "q5",
            "before": "",
            "after": "",
            "prompt": "_____ this book. It's horrible.",
            "options": [
              "Let's read",
              "Don't read",
              "You don't read"
            ]
          },
          {
            "id": "q6",
            "before": "",
            "after": "",
            "prompt": "_____ the window, please. It's very cold outside.",
            "options": [
              "You don't open",
              "Open",
              "Don't open"
            ]
          },
          {
            "id": "q7",
            "before": "",
            "after": "",
            "prompt": "_____ the light, please. It's very dark.",
            "options": [
              "Let's turn on",
              "Don't turn",
              "Turn on"
            ]
          },
          {
            "id": "q8",
            "before": "",
            "after": "",
            "prompt": "_____ sad for me. I'm OK.",
            "options": [
              "Aren't",
              "Don't be",
              "You not be"
            ]
          },
          {
            "id": "q9",
            "before": "",
            "after": "",
            "prompt": "The fridge is empty. _____ to a restaurant today.",
            "options": [
              "Let's go",
              "You go",
              "Don't go"
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": "",
            "prompt": "A: '_____ a piece of cake.' B: 'Thanks.'",
            "options": [
              "Let's have",
              "Have",
              "Don't have"
            ]
          }
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Write the correct imperative form or let’s + verb forms to complete the following sentences. Use the same verb used in the previous sentence.",
        "questions": [
          {
            "id": "q1",
            "before": "A: 'I'll turn off the TV.' B: 'No, ",
            "after": " the TV, please.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "A: 'I'll call you this evening.' B: 'Yes, ",
            "after": " me this evening, please.'",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "A: 'Do you want to listen to music.' B: 'Yes, ",
            "after": " to music.'",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "A: 'Let's go to the cinema.' B: 'No, ",
            "after": " to the cinema. Let's stay home and watch TV.'",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "A: 'I will wake you up at 7.' B: 'No, ",
            "after": " me up at 7. It's too early.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "A: 'I will clean the fridge.' B: 'Yes, ",
            "after": " the fridge, please. It's very dirty.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "A: 'I will open a bottle of wine.' B: 'No, ",
            "after": " a bottle of wine, please. I prefer beer.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "A: 'Would you like to have a picnic in the park?' B: 'Yes, ",
            "after": " a picnic in the park. What a great idea!'",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "A: 'I will order some pizza.' B:'Yes, ",
            "after": " some pizza, please. I am too tired to cook.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "A: 'Do you want to talk about work?' B: 'No, ",
            "after": " about work. Let's talk about something different.'",
            "options": [],
            "kind": "text"
          }
        ],
        "context": "EXAMPLE: A: ‘Let’s play tennis.’ B:’No, let’s not play tennis.",
        "passage": [
          [
            {
              "text": "A: 'I'll turn off the TV.' B: 'No, "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " the TV, please."
            }
          ],
          [
            {
              "text": "A: 'I'll call you this evening.' B: 'Yes, "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " me this evening, please.'"
            }
          ],
          [
            {
              "text": "A: 'Do you want to listen to music.' B: 'Yes, "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " to music.'"
            }
          ],
          [
            {
              "text": "A: 'Let's go to the cinema.' B: 'No, "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " to the cinema. Let's stay home and watch TV.'"
            }
          ],
          [
            {
              "text": "A: 'I will wake you up at 7.' B: 'No, "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " me up at 7. It's too early."
            }
          ],
          [
            {
              "text": "A: 'I will clean the fridge.' B: 'Yes, "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " the fridge, please. It's very dirty."
            }
          ],
          [
            {
              "text": "A: 'I will open a bottle of wine.' B: 'No, "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " a bottle of wine, please. I prefer beer."
            }
          ],
          [
            {
              "text": "A: 'Would you like to have a picnic in the park?' B: 'Yes, "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " a picnic in the park. What a great idea!'"
            }
          ],
          [
            {
              "text": "A: 'I will order some pizza.' B:'Yes, "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " some pizza, please. I am too tired to cook."
            }
          ],
          [
            {
              "text": "A: 'Do you want to talk about work?' B: 'No, "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " about work. Let's talk about something different.'"
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-was-were",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "Was/were: Past simple of 'be'",
    "subtitle": "A1 grammar · all exercises",
    "cover": {
      "src": "/images/tests/a1-was-were-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: Was/were: Past simple of 'be'"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Choose was/were or am/is/are to complete the following sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "My son ",
            "after": " short in school, but now he … tall.",
            "options": [
              "were",
              "was"
            ]
          },
          {
            "id": "q2",
            "before": "My son … short in school, but now he ",
            "after": " tall.",
            "options": [
              "am",
              "are",
              "is"
            ]
          },
          {
            "id": "q3",
            "before": "'",
            "after": " you at the stadium yesterday?' 'Yes, I ….'",
            "options": [
              "Were",
              "Was"
            ]
          },
          {
            "id": "q4",
            "before": "'… you at the stadium yesterday?' 'Yes, I ",
            "after": ".'",
            "options": [
              "were",
              "was",
              "'s"
            ]
          },
          {
            "id": "q5",
            "before": "Yesterday Philip and Emma ",
            "after": " in London. Today they … in Paris.",
            "options": [
              "was",
              "were"
            ]
          },
          {
            "id": "q6",
            "before": "Yesterday Philip and Emma … in London. Today they ",
            "after": " in Paris.",
            "options": [
              "am",
              "is",
              "are"
            ]
          },
          {
            "id": "q7",
            "before": "Sara and I ",
            "after": " at home that night, and you … with us.",
            "options": [
              "were",
              "was"
            ]
          },
          {
            "id": "q8",
            "before": "Sara and I … at home that night, and you ",
            "after": " with us.",
            "options": [
              "was",
              "were"
            ]
          },
          {
            "id": "q9",
            "before": "Yesterday we ",
            "after": " late for the concert, and today I … late for class.",
            "options": [
              "were",
              "was"
            ]
          },
          {
            "id": "q10",
            "before": "Yesterday we … late for the concert, and today I ",
            "after": " late for class.",
            "options": [
              "is",
              "am",
              "are"
            ]
          },
          {
            "id": "q11",
            "before": "Asim ",
            "after": " born in Egypt, and I … born in Birmingham.",
            "options": [
              "were",
              "was",
              "is"
            ]
          },
          {
            "id": "q12",
            "before": "Asim … born in Egypt, and I ",
            "after": " born in Birmingham.",
            "options": [
              "were",
              "am",
              "was"
            ]
          },
          {
            "id": "q13",
            "before": "'",
            "after": " you excited about the trip?' 'Yes, we … very excited.'",
            "options": [
              "Were",
              "Was"
            ]
          },
          {
            "id": "q14",
            "before": "'… you excited about the trip?' 'Yes, we ",
            "after": " very excited.'",
            "options": [
              "'re",
              "was",
              "were"
            ]
          },
          {
            "id": "q15",
            "before": "'",
            "after": " Kate angry yesterday after the meeting?' 'No, but I think she … angry now.'",
            "options": [
              "Were",
              "Was"
            ]
          },
          {
            "id": "q16",
            "before": "'… Kate angry yesterday after the meeting?' 'No, but I think she ",
            "after": " angry now.'",
            "options": [
              "is",
              "are",
              "am"
            ]
          },
          {
            "id": "q17",
            "before": "'",
            "after": " you at the beach last Sunday?' 'Yes, I ….",
            "options": [
              "Was",
              "Were"
            ]
          },
          {
            "id": "q18",
            "before": "'… you at the beach last Sunday?' 'Yes, I ",
            "after": ".",
            "options": [
              "was",
              "were"
            ]
          },
          {
            "id": "q19",
            "before": "The weather ",
            "after": " nice today, but it … horrible last weekend.",
            "options": [
              "are",
              "was",
              "is"
            ]
          },
          {
            "id": "q20",
            "before": "The weather … nice today, but it ",
            "after": " horrible last weekend.",
            "options": [
              "was",
              "were"
            ]
          }
        ],
        "passage": [
          [
            {
              "text": "My son "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " short in school, but now he "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " tall."
            }
          ],
          [
            {
              "text": "'"
            },
            {
              "questionId": "q3"
            },
            {
              "text": " you at the stadium yesterday?' 'Yes, I "
            },
            {
              "questionId": "q4"
            },
            {
              "text": ".'"
            }
          ],
          [
            {
              "text": "Yesterday Philip and Emma "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " in London. Today they "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " in Paris."
            }
          ],
          [
            {
              "text": "Sara and I "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " at home that night, and you "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " with us."
            }
          ],
          [
            {
              "text": "Yesterday we "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " late for the concert, and today I "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " late for class."
            }
          ],
          [
            {
              "text": "Asim "
            },
            {
              "questionId": "q11"
            },
            {
              "text": " born in Egypt, and I "
            },
            {
              "questionId": "q12"
            },
            {
              "text": " born in Birmingham."
            }
          ],
          [
            {
              "text": "'"
            },
            {
              "questionId": "q13"
            },
            {
              "text": " you excited about the trip?' 'Yes, we "
            },
            {
              "questionId": "q14"
            },
            {
              "text": " very excited.'"
            }
          ],
          [
            {
              "text": "'"
            },
            {
              "questionId": "q15"
            },
            {
              "text": " Kate angry yesterday after the meeting?' 'No, but I think she "
            },
            {
              "questionId": "q16"
            },
            {
              "text": " angry now.'"
            }
          ],
          [
            {
              "text": "'"
            },
            {
              "questionId": "q17"
            },
            {
              "text": " you at the beach last Sunday?' 'Yes, I "
            },
            {
              "questionId": "q18"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "The weather "
            },
            {
              "questionId": "q19"
            },
            {
              "text": " nice today, but it "
            },
            {
              "questionId": "q20"
            },
            {
              "text": " horrible last weekend."
            }
          ]
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Complete the following sentences with was/were or wasn’t/weren’t.",
        "questions": [
          {
            "id": "q1",
            "before": "Where ",
            "after": " you last night? I called you, but you … at home.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "Where … you last night? I called you, but you ",
            "after": " at home.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "'",
            "after": " Sandra happy after the exam?' 'No, she ….'",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "'… Sandra happy after the exam?' 'No, she ",
            "after": ".'",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "I remember I ",
            "after": " very worried, but you … calm.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "I remember I … very worried, but you ",
            "after": " calm.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "Betty and Paul ",
            "after": " at home; they … at the cinema",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "Betty and Paul … at home; they ",
            "after": " at the cinema",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "'",
            "after": " you tired after the concert?' 'Yes, I ….'",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "'… you tired after the concert?' 'Yes, I ",
            "after": ".'",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q11",
            "before": "I'm very sorry. You ",
            "after": " right, and I … wrong.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q12",
            "before": "I'm very sorry. You … right, and I ",
            "after": " wrong.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q13",
            "before": "'Were your parents at the meeting?' 'My dad ",
            "after": " there, but my mum ….'",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q14",
            "before": "'Were your parents at the meeting?' 'My dad … there, but my mum ",
            "after": ".'",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q15",
            "before": "We ",
            "after": " late! We … early. The concert was at 8 and we arrived at 7.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q16",
            "before": "We … late! We ",
            "after": " early. The concert was at 8 and we arrived at 7.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q17",
            "before": "Vivian ",
            "after": " at the meeting, but I … there. I always go to the meetings.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q18",
            "before": "Vivian … at the meeting, but I ",
            "after": " there. I always go to the meetings.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q19",
            "before": "'",
            "after": " Tim with you?' 'No, only Sally and Peter … there with me.'",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q20",
            "before": "'… Tim with you?' 'No, only Sally and Peter ",
            "after": " there with me.'",
            "options": [],
            "kind": "text"
          }
        ],
        "passage": [
          [
            {
              "text": "Where "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " you last night? I called you, but you "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " at home."
            }
          ],
          [
            {
              "text": "'"
            },
            {
              "questionId": "q3"
            },
            {
              "text": " Sandra happy after the exam?' 'No, she "
            },
            {
              "questionId": "q4"
            },
            {
              "text": ".'"
            }
          ],
          [
            {
              "text": "I remember I "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " very worried, but you "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " calm."
            }
          ],
          [
            {
              "text": "Betty and Paul "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " at home; they "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " at the cinema"
            }
          ],
          [
            {
              "text": "'"
            },
            {
              "questionId": "q9"
            },
            {
              "text": " you tired after the concert?' 'Yes, I "
            },
            {
              "questionId": "q10"
            },
            {
              "text": ".'"
            }
          ],
          [
            {
              "text": "I'm very sorry. You "
            },
            {
              "questionId": "q11"
            },
            {
              "text": " right, and I "
            },
            {
              "questionId": "q12"
            },
            {
              "text": " wrong."
            }
          ],
          [
            {
              "text": "'Were your parents at the meeting?' 'My dad "
            },
            {
              "questionId": "q13"
            },
            {
              "text": " there, but my mum "
            },
            {
              "questionId": "q14"
            },
            {
              "text": ".'"
            }
          ],
          [
            {
              "text": "We "
            },
            {
              "questionId": "q15"
            },
            {
              "text": " late! We "
            },
            {
              "questionId": "q16"
            },
            {
              "text": " early. The concert was at 8 and we arrived at 7."
            }
          ],
          [
            {
              "text": "Vivian "
            },
            {
              "questionId": "q17"
            },
            {
              "text": " at the meeting, but I "
            },
            {
              "questionId": "q18"
            },
            {
              "text": " there. I always go to the meetings."
            }
          ],
          [
            {
              "text": "'"
            },
            {
              "questionId": "q19"
            },
            {
              "text": " Tim with you?' 'No, only Sally and Peter "
            },
            {
              "questionId": "q20"
            },
            {
              "text": " there with me.'"
            }
          ]
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Write questions using was/were and the words below. Put the words in the correct order.",
        "questions": [
          {
            "id": "q1",
            "before": "the keys / where ⇒ ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "Robin / why / at the meeting ⇒ ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "born / she / when ⇒ ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "how expensive / the hotel ⇒ ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "why / you / angry ⇒ ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "unconscious / I / after the accident ⇒ ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "the questions / difficult ⇒ ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "the accident / what time ⇒ ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "you / how often / in contact with them ⇒ ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "where / you and Tom / last night ⇒ ",
            "after": "?",
            "options": [],
            "kind": "text"
          }
        ],
        "context": "EXAMPLE: you / what time / at the station ⇒ What time were you at the station?",
        "passage": [
          [
            {
              "text": "the keys / where ⇒ "
            },
            {
              "questionId": "q1"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "Robin / why / at the meeting ⇒ "
            },
            {
              "questionId": "q2"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "born / she / when ⇒ "
            },
            {
              "questionId": "q3"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "how expensive / the hotel ⇒ "
            },
            {
              "questionId": "q4"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "why / you / angry ⇒ "
            },
            {
              "questionId": "q5"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "unconscious / I / after the accident ⇒ "
            },
            {
              "questionId": "q6"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "the questions / difficult ⇒ "
            },
            {
              "questionId": "q7"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "the accident / what time ⇒ "
            },
            {
              "questionId": "q8"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "you / how often / in contact with them ⇒ "
            },
            {
              "questionId": "q9"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "where / you and Tom / last night ⇒ "
            },
            {
              "questionId": "q10"
            },
            {
              "text": "?"
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-past-simple-regular-irregular",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "Past simple: Regular/irregular verbs",
    "subtitle": "A1 grammar · all exercises",
    "cover": {
      "src": "/images/tests/a1-past-simple-regular-irregular-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: Past simple: Regular/irregular verbs"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Write the past simple forms of the regular verbs in brackets to complete these sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "I ",
            "after": " (study) all night yesterday.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "We ",
            "after": " (play) poker after dinner.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "After escaping from prison, he ",
            "after": " (rob) a bank.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "He ",
            "after": " (start) playing chess at the age of 7.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "We ",
            "after": " (arrive) home very late.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "We ",
            "after": " (visit) the Louvre while we were in Paris.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "He ",
            "after": " (try) to escape.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "I ",
            "after": " (stop) smoking when I was 30.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "When I was a child, I ",
            "after": " (hate) fish.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "We really ",
            "after": " (enjoy) the concert.",
            "options": [],
            "kind": "text"
          }
        ],
        "passage": [
          [
            {
              "text": "I "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " (study) all night yesterday."
            }
          ],
          [
            {
              "text": "We "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " (play) poker after dinner."
            }
          ],
          [
            {
              "text": "After escaping from prison, he "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " (rob) a bank."
            }
          ],
          [
            {
              "text": "He "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " (start) playing chess at the age of 7."
            }
          ],
          [
            {
              "text": "We "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " (arrive) home very late."
            }
          ],
          [
            {
              "text": "We "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " (visit) the Louvre while we were in Paris."
            }
          ],
          [
            {
              "text": "He "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " (try) to escape."
            }
          ],
          [
            {
              "text": "I "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " (stop) smoking when I was 30."
            }
          ],
          [
            {
              "text": "When I was a child, I "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " (hate) fish."
            }
          ],
          [
            {
              "text": "We really "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " (enjoy) the concert."
            }
          ]
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Write the past simple forms of the irregular verbs in brackets to complete these sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "I ",
            "after": " (find) my true love when I was 50.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "We ",
            "after": " (buy) this sofa in the shop at the end of the street.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "We never ",
            "after": " (wear) uniforms in school.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "I ",
            "after": " (forget) to tell you something important.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "I ",
            "after": " (see) Peter at the theater last week.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "After the meeting, I ",
            "after": " (speak) with my boss.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "Yesterday I ",
            "after": " (drive) to work.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "She ",
            "after": " (run) her first marathon when she was 18.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "I ",
            "after": " (make) a lot of mistakes during the match.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "Somebody ",
            "after": " (eat) my biscuits without telling me.",
            "options": [],
            "kind": "text"
          }
        ],
        "passage": [
          [
            {
              "text": "I "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " (find) my true love when I was 50."
            }
          ],
          [
            {
              "text": "We "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " (buy) this sofa in the shop at the end of the street."
            }
          ],
          [
            {
              "text": "We never "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " (wear) uniforms in school."
            }
          ],
          [
            {
              "text": "I "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " (forget) to tell you something important."
            }
          ],
          [
            {
              "text": "I "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " (see) Peter at the theater last week."
            }
          ],
          [
            {
              "text": "After the meeting, I "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " (speak) with my boss."
            }
          ],
          [
            {
              "text": "Yesterday I "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " (drive) to work."
            }
          ],
          [
            {
              "text": "She "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " (run) her first marathon when she was 18."
            }
          ],
          [
            {
              "text": "I "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " (make) a lot of mistakes during the match."
            }
          ],
          [
            {
              "text": "Somebody "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " (eat) my biscuits without telling me."
            }
          ]
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Complete the text with these verbs in past simple.",
        "questions": [
          {
            "id": "q1",
            "before": "Two summers ago, we  ",
            "after": " on a trip to New York. We  … from Manchester to John F. Kennedy International Airport. The journey was long, but we were very excited; we are from a little village and we really  … to visit a megacity like New York. When we  … at our destination, we  … a taxi to our hotel in Manhattan. The taxi driver was very nice and  … us lots of things about New York and Manhattan.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "Two summers ago, we  … on a trip to New York. We  ",
            "after": " from Manchester to John F. Kennedy International Airport. The journey was long, but we were very excited; we are from a little village and we really  … to visit a megacity like New York. When we  … at our destination, we  … a taxi to our hotel in Manhattan. The taxi driver was very nice and  … us lots of things about New York and Manhattan.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "Two summers ago, we  … on a trip to New York. We  … from Manchester to John F. Kennedy International Airport. The journey was long, but we were very excited; we are from a little village and we really  ",
            "after": " to visit a megacity like New York. When we  … at our destination, we  … a taxi to our hotel in Manhattan. The taxi driver was very nice and  … us lots of things about New York and Manhattan.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "Two summers ago, we  … on a trip to New York. We  … from Manchester to John F. Kennedy International Airport. The journey was long, but we were very excited; we are from a little village and we really  … to visit a megacity like New York. When we  ",
            "after": " at our destination, we  … a taxi to our hotel in Manhattan. The taxi driver was very nice and  … us lots of things about New York and Manhattan.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "Two summers ago, we  … on a trip to New York. We  … from Manchester to John F. Kennedy International Airport. The journey was long, but we were very excited; we are from a little village and we really  … to visit a megacity like New York. When we  … at our destination, we  ",
            "after": " a taxi to our hotel in Manhattan. The taxi driver was very nice and  … us lots of things about New York and Manhattan.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "Two summers ago, we  … on a trip to New York. We  … from Manchester to John F. Kennedy International Airport. The journey was long, but we were very excited; we are from a little village and we really  … to visit a megacity like New York. When we  … at our destination, we  … a taxi to our hotel in Manhattan. The taxi driver was very nice and  ",
            "after": " us lots of things about New York and Manhattan.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "\"How much is it?\" I asked the taxi driver when he  ",
            "after": " his car in front of the hotel. When he  … that it was 95 dollars, I  … that it wasn't possible, but it was! For the first –and I hope the last– time in my life, I  … 95 dollars for a taxi. I guess that's one of the problems of big cities, they are really expensive.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "\"How much is it?\" I asked the taxi driver when he  … his car in front of the hotel. When he  ",
            "after": " that it was 95 dollars, I  … that it wasn't possible, but it was! For the first –and I hope the last– time in my life, I  … 95 dollars for a taxi. I guess that's one of the problems of big cities, they are really expensive.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "\"How much is it?\" I asked the taxi driver when he  … his car in front of the hotel. When he  … that it was 95 dollars, I  ",
            "after": " that it wasn't possible, but it was! For the first –and I hope the last– time in my life, I  … 95 dollars for a taxi. I guess that's one of the problems of big cities, they are really expensive.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "\"How much is it?\" I asked the taxi driver when he  … his car in front of the hotel. When he  … that it was 95 dollars, I  … that it wasn't possible, but it was! For the first –and I hope the last– time in my life, I  ",
            "after": " 95 dollars for a taxi. I guess that's one of the problems of big cities, they are really expensive.",
            "options": [],
            "kind": "text"
          }
        ],
        "context": "arrive – ask – fly – go – pay – say – stop – take – tell – think – want",
        "passage": [
          [
            {
              "text": "Two summers ago, we  "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " on a trip to New York. We  "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " from Manchester to John F. Kennedy International Airport. The journey was long, but we were very excited; we are from a little village and we really  "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " to visit a megacity like New York. When we  "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " at our destination, we  "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " a taxi to our hotel in Manhattan. The taxi driver was very nice and  "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " us lots of things about New York and Manhattan."
            }
          ],
          [
            {
              "text": "\"How much is it?\" I asked the taxi driver when he  "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " his car in front of the hotel. When he  "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " that it was 95 dollars, I  "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " that it wasn't possible, but it was! For the first –and I hope the last– time in my life, I  "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " 95 dollars for a taxi. I guess that's one of the problems of big cities, they are really expensive."
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-past-simple-negatives-questions",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "Past simple: Negatives and questions",
    "subtitle": "A1 grammar · all exercises",
    "cover": {
      "src": "/images/tests/a1-past-simple-negatives-questions-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: Past simple: Negatives and questions"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Choose the correct past simple forms to complete the sentences below.",
        "questions": [
          {
            "id": "q1",
            "before": "Where ",
            "after": " on holiday last summer?",
            "options": [
              "did you go",
              "did you went",
              "went you"
            ]
          },
          {
            "id": "q2",
            "before": "They ",
            "after": " until 5 o'clock in the afternoon.",
            "options": [
              "weren't arrived",
              "didn't arrive",
              "didn't arrived"
            ]
          },
          {
            "id": "q3",
            "before": "They ",
            "after": " sure of what to do.",
            "options": [
              "weren't",
              "didn't were",
              "didn't be"
            ]
          },
          {
            "id": "q4",
            "before": "We ",
            "after": " after midnight.",
            "options": [
              "didn't arrived",
              "arrived",
              "did arrive"
            ]
          },
          {
            "id": "q5",
            "before": "",
            "after": " the present?",
            "options": [
              "Did you like",
              "did you liked",
              "Were you like"
            ]
          },
          {
            "id": "q6",
            "before": "Sara ",
            "after": " the film because she was asleep.",
            "options": [
              "weren't watch",
              "didn't watched",
              "didn't watch"
            ]
          },
          {
            "id": "q7",
            "before": "John and Felicity ",
            "after": " married last year.",
            "options": [
              "got",
              "were get",
              "did get"
            ]
          },
          {
            "id": "q8",
            "before": "She ",
            "after": " ready for the test.",
            "options": [
              "didn't be",
              "wasn't",
              "didn't was"
            ]
          },
          {
            "id": "q9",
            "before": "I ",
            "after": " the question. Can you repeat it?",
            "options": [
              "wasn't understood",
              "didn't understand",
              "didn't understood"
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": " when he saw you?",
            "options": [
              "Did he smiled",
              "Was he smile",
              "Did he smile"
            ]
          }
        ],
        "passage": [
          [
            {
              "text": "Where "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " on holiday last summer?"
            }
          ],
          [
            {
              "text": "They "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " until 5 o'clock in the afternoon."
            }
          ],
          [
            {
              "text": "They "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " sure of what to do."
            }
          ],
          [
            {
              "text": "We "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " after midnight."
            }
          ],
          [
            {
              "questionId": "q5"
            },
            {
              "text": " the present?"
            }
          ],
          [
            {
              "text": "Sara "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " the film because she was asleep."
            }
          ],
          [
            {
              "text": "John and Felicity "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " married last year."
            }
          ],
          [
            {
              "text": "She "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " ready for the test."
            }
          ],
          [
            {
              "text": "I "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " the question. Can you repeat it?"
            }
          ],
          [
            {
              "questionId": "q10"
            },
            {
              "text": " when he saw you?"
            }
          ]
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Choose the correct past simple forms to complete these sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": "",
            "prompt": "We _____ a bus to Chicago last week.",
            "options": [
              "were took",
              "did took",
              "took"
            ]
          },
          {
            "id": "q2",
            "before": "",
            "after": "",
            "prompt": "_____ to the party last weekend?",
            "options": [
              "Did you go",
              "Went you",
              "Did you went"
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": "",
            "prompt": "Yesterday I ____ the train, but I ____ late for work.",
            "options": [
              "did miss / were not",
              "missed / didn't be",
              "missed / wasn't"
            ]
          },
          {
            "id": "q4",
            "before": "",
            "after": "",
            "prompt": "They _____ a swimming pool in their backyard last summer.",
            "options": [
              "did put",
              "putted",
              "put"
            ]
          },
          {
            "id": "q5",
            "before": "",
            "after": "",
            "prompt": "Where _____ this afternoon?",
            "options": [
              "were he go",
              "did he go",
              "did he went"
            ]
          },
          {
            "id": "q6",
            "before": "",
            "after": "",
            "prompt": "She _____ home early from the party yesterday.",
            "options": [
              "came",
              "camed",
              "didn't came"
            ]
          },
          {
            "id": "q7",
            "before": "",
            "after": "",
            "prompt": "How much _____ for it?",
            "options": [
              "did you paid",
              "did you pay",
              "paid you"
            ]
          },
          {
            "id": "q8",
            "before": "",
            "after": "",
            "prompt": "They _____ the play very much.",
            "options": [
              "weren't enjoy",
              "didn't enjoyed",
              "didn't enjoy"
            ]
          },
          {
            "id": "q9",
            "before": "",
            "after": "",
            "prompt": "When _____ that crazy idea?",
            "options": [
              "did you got",
              "did you get",
              "got you"
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": "",
            "prompt": "Where _____ last night?",
            "options": [
              "were you",
              "did you be",
              "did you were"
            ]
          }
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Complete the conversation using the words in brackets to make past simple positive, negative, and questions.",
        "questions": [
          {
            "id": "q1",
            "before": "Emma: Where ",
            "after": " (you/travel) this summer?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "Phil: We ",
            "after": " (go) to Playa del Carmen, in Mexico.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "Emma: Where ",
            "after": " (you/stay)?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "Phil: We ",
            "after": " (stay) in a nice beach resort.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "Emma: ",
            "after": " (your children/like) it?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "Phil: Of course! They ",
            "after": " (spend) all week on the beach.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "Emma: ",
            "after": " (be/you) there for one week?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "Phil: Yes. We ",
            "after": " (come) back last Sunday.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "Emma: ",
            "after": " (your wife/enjoy) the trip too?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "Phil: Yes, she ",
            "after": ", although she … (not like) the food too much.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q11",
            "before": "Phil: Yes, she …, although she ",
            "after": " (not like) the food too much.",
            "options": [],
            "kind": "text"
          }
        ],
        "passage": [
          [
            {
              "text": "Emma: Where "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " (you/travel) this summer?"
            }
          ],
          [
            {
              "text": "Phil: We "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " (go) to Playa del Carmen, in Mexico."
            }
          ],
          [
            {
              "text": "Emma: Where "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " (you/stay)?"
            }
          ],
          [
            {
              "text": "Phil: We "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " (stay) in a nice beach resort."
            }
          ],
          [
            {
              "text": "Emma: "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " (your children/like) it?"
            }
          ],
          [
            {
              "text": "Phil: Of course! They "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " (spend) all week on the beach."
            }
          ],
          [
            {
              "text": "Emma: "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " (be/you) there for one week?"
            }
          ],
          [
            {
              "text": "Phil: Yes. We "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " (come) back last Sunday."
            }
          ],
          [
            {
              "text": "Emma: "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " (your wife/enjoy) the trip too?"
            }
          ],
          [
            {
              "text": "Phil: Yes, she "
            },
            {
              "questionId": "q10"
            },
            {
              "text": ", although she "
            },
            {
              "questionId": "q11"
            },
            {
              "text": " (not like) the food too much."
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-verbs-infinitive-verbs-ing",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "Verbs + to + infinitive and verbs + -ing",
    "subtitle": "A1 grammar · all exercises",
    "cover": {
      "src": "/images/tests/a1-verbs-infinitive-verbs-ing-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: Verbs + to + infinitive and verbs + -ing"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Choose the correct infinitive or -ing forms.",
        "questions": [
          {
            "id": "q1",
            "before": "Pam loves ",
            "after": " letters.",
            "options": [
              "receiving",
              "receive",
              "receivings"
            ]
          },
          {
            "id": "q2",
            "before": "She's planning ",
            "after": " on a trip to Paris.",
            "options": [
              "to going",
              "going",
              "to go"
            ]
          },
          {
            "id": "q3",
            "before": "Would you like ",
            "after": " a picnic?",
            "options": [
              "having",
              "have",
              "to have"
            ]
          },
          {
            "id": "q4",
            "before": "My son never wants ",
            "after": " to bed.",
            "options": [
              "going",
              "to go",
              "goes"
            ]
          },
          {
            "id": "q5",
            "before": "I don't mind ",
            "after": " the dishes.",
            "options": [
              "to wash",
              "washing",
              "wash"
            ]
          },
          {
            "id": "q6",
            "before": "Sorry, I forgot ",
            "after": " you this afternoon.",
            "options": [
              "calling",
              "to call",
              "call"
            ]
          },
          {
            "id": "q7",
            "before": "Do you like ",
            "after": "?",
            "options": [
              "drive",
              "to driving",
              "driving"
            ]
          },
          {
            "id": "q8",
            "before": "Please, remember ",
            "after": " me the information that I need.",
            "options": [
              "sending",
              "to send",
              "send"
            ]
          },
          {
            "id": "q9",
            "before": "I'd like ",
            "after": " you some questions.",
            "options": [
              "asking",
              "ask",
              "to ask"
            ]
          },
          {
            "id": "q10",
            "before": "I learned ",
            "after": " the guitar when I was 6.",
            "options": [
              "played",
              "to play",
              "playing"
            ]
          }
        ],
        "passage": [
          [
            {
              "text": "Pam loves "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " letters."
            }
          ],
          [
            {
              "text": "She's planning "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " on a trip to Paris."
            }
          ],
          [
            {
              "text": "Would you like "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " a picnic?"
            }
          ],
          [
            {
              "text": "My son never wants "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " to bed."
            }
          ],
          [
            {
              "text": "I don't mind "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " the dishes."
            }
          ],
          [
            {
              "text": "Sorry, I forgot "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " you this afternoon."
            }
          ],
          [
            {
              "text": "Do you like "
            },
            {
              "questionId": "q7"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "Please, remember "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " me the information that I need."
            }
          ],
          [
            {
              "text": "I'd like "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " you some questions."
            }
          ],
          [
            {
              "text": "I learned "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " the guitar when I was 6."
            }
          ]
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Choose the correct infinitive or -ing forms to complete these sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": "",
            "prompt": "When I was a child, I hated ______ to school.",
            "options": [
              "went",
              "going",
              "go"
            ]
          },
          {
            "id": "q2",
            "before": "",
            "after": "",
            "prompt": "I hope _____ a good lawyer.",
            "options": [
              "find",
              "to find",
              "finding"
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": "",
            "prompt": "He's very unfit; he needs _____ more exercise.",
            "options": [
              "to do",
              "does",
              "doing"
            ]
          },
          {
            "id": "q4",
            "before": "",
            "after": "",
            "prompt": "A: 'Would you like _____?' B: 'No, thanks. I don't like _____.'",
            "options": [
              "dancing / dancing",
              "dancing / to dance",
              "to dance / dancing"
            ]
          },
          {
            "id": "q5",
            "before": "",
            "after": "",
            "prompt": "I don't like _____ early, but I need ______ it.",
            "options": [
              "getting up / to do",
              "to get up / doing",
              "getting up / doing"
            ]
          },
          {
            "id": "q6",
            "before": "",
            "after": "",
            "prompt": "I don't mind _____, but we need the car today because it's late.",
            "options": [
              "walk",
              "to walk",
              "walking"
            ]
          },
          {
            "id": "q7",
            "before": "",
            "after": "",
            "prompt": "When did you learn _____?",
            "options": [
              "swam",
              "to swim",
              "swimming"
            ]
          },
          {
            "id": "q8",
            "before": "",
            "after": "",
            "prompt": "My car was at the mechanic and she offered _____ me home.",
            "options": [
              "to drive",
              "driving",
              "drove"
            ]
          },
          {
            "id": "q9",
            "before": "",
            "after": "",
            "prompt": "My dog loves _____ with other dogs.",
            "options": [
              "play",
              "playing",
              "plays"
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": "",
            "prompt": "He plans _____ in Boston next year.",
            "options": [
              "to stay",
              "staying",
              "stays"
            ]
          }
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Complete the sentences using the to + infinitive or the -ing forms of the verbs in the list.",
        "questions": [
          {
            "id": "q1",
            "before": "Please, turn on the TV. I want ",
            "after": " the football match.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "I don't mind ",
            "after": " my English homework.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "Did you remember ",
            "after": " the plants?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "I don't like ",
            "after": " in an office.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "I hope ",
            "after": " you soon.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "The food is delicious. Where did you learn ",
            "after": " this dish?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "I need ",
            "after": " very early tomorrow morning. I start work at 7 a.m.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "I think I forgot ",
            "after": " the windows.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "Do you like ",
            "after": " football?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "We'd like ",
            "after": " football this afternoon.",
            "options": [],
            "kind": "text"
          }
        ],
        "context": "close – cook – do – get up – play(x2) – see – travel – watch – water – work EXAMPLE: I’m planning ⇒ to travel to Egypt next year.",
        "passage": [
          [
            {
              "text": "Please, turn on the TV. I want "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " the football match."
            }
          ],
          [
            {
              "text": "I don't mind "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " my English homework."
            }
          ],
          [
            {
              "text": "Did you remember "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " the plants?"
            }
          ],
          [
            {
              "text": "I don't like "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " in an office."
            }
          ],
          [
            {
              "text": "I hope "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " you soon."
            }
          ],
          [
            {
              "text": "The food is delicious. Where did you learn "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " this dish?"
            }
          ],
          [
            {
              "text": "I need "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " very early tomorrow morning. I start work at 7 a.m."
            }
          ],
          [
            {
              "text": "I think I forgot "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " the windows."
            }
          ],
          [
            {
              "text": "Do you like "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " football?"
            }
          ],
          [
            {
              "text": "We'd like "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " football this afternoon."
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-would-like",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "Would you like...? I'd like...",
    "subtitle": "A1 grammar · all exercises",
    "cover": {
      "src": "/images/tests/a1-would-like-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: Would you like...? I'd like..."
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Read the following sentences with Do you want or I want and write sentences with the same meaning using would you like or I’d like.",
        "questions": [
          {
            "id": "q1",
            "before": "I want to go out tonight. ⇒ ",
            "after": " tonight.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "Do you want to come with us? ⇒ ",
            "after": " with us?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "Do you want a sandwich? ⇒ ",
            "after": " a sandwich?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "I want a bottle of water, please. ⇒ ",
            "after": " a bottle of water, please.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "Where do you want to go? ⇒ Where ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "I want to learn French. ⇒ ",
            "after": " French.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "What do you want for dessert? ⇒ What ",
            "after": " for dessert?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "I want to stay with you today. ⇒ ",
            "after": " with you today.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "Do you want to meet my family? ⇒ ",
            "after": " my family?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "I want an answer. ⇒ I ",
            "after": " an answer.",
            "options": [],
            "kind": "text"
          }
        ],
        "context": "EXAMPLES: I want some coffee. ⇒ I’d like some coffee. Do you want some coffee? ⇒ Would you like some coffee?",
        "passage": [
          [
            {
              "text": "I want to go out tonight. ⇒ "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " tonight."
            }
          ],
          [
            {
              "text": "Do you want to come with us? ⇒ "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " with us?"
            }
          ],
          [
            {
              "text": "Do you want a sandwich? ⇒ "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " a sandwich?"
            }
          ],
          [
            {
              "text": "I want a bottle of water, please. ⇒ "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " a bottle of water, please."
            }
          ],
          [
            {
              "text": "Where do you want to go? ⇒ Where "
            },
            {
              "questionId": "q5"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "I want to learn French. ⇒ "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " French."
            }
          ],
          [
            {
              "text": "What do you want for dessert? ⇒ What "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " for dessert?"
            }
          ],
          [
            {
              "text": "I want to stay with you today. ⇒ "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " with you today."
            }
          ],
          [
            {
              "text": "Do you want to meet my family? ⇒ "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " my family?"
            }
          ],
          [
            {
              "text": "I want an answer. ⇒ I "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " an answer."
            }
          ]
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Choose the correct forms to complete the following sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": "",
            "prompt": "I _____ travel to Spain one day.",
            "options": [
              "'d like",
              "like",
              "would like to"
            ]
          },
          {
            "id": "q2",
            "before": "",
            "after": "",
            "prompt": "I _____ playing computer games with my friends.",
            "options": [
              "like",
              "'d like",
              "'d like to"
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": "",
            "prompt": "A: _____ a glass of water? B: Yes, please. I'm thirsty.",
            "options": [
              "Do you like",
              "Would you like",
              "I'd like"
            ]
          },
          {
            "id": "q4",
            "before": "",
            "after": "",
            "prompt": "Susan _____ to work in our school next year.",
            "options": [
              "would like",
              "likes",
              "like"
            ]
          },
          {
            "id": "q5",
            "before": "",
            "after": "",
            "prompt": "What time would you like _____ this evening?",
            "options": [
              "to have dinner",
              "having dinner",
              "have dinner"
            ]
          },
          {
            "id": "q6",
            "before": "",
            "after": "",
            "prompt": "I'm tired. I'd like _____ early today.",
            "options": [
              "going to bed",
              "go to bed",
              "to go to bed"
            ]
          },
          {
            "id": "q7",
            "before": "",
            "after": "",
            "prompt": "We _____ watching TV during dinner.",
            "options": [
              "'d like",
              "like",
              "'d like to"
            ]
          },
          {
            "id": "q8",
            "before": "",
            "after": "",
            "prompt": "A: _____ your new job? B: Yes, it's fantastic.",
            "options": [
              "Do you like",
              "Would you like",
              "I'd like"
            ]
          },
          {
            "id": "q9",
            "before": "",
            "after": "",
            "prompt": "A: _____ something to eat? B: No, thanks. I'm not hungry.",
            "options": [
              "Do you like",
              "I'd like",
              "Would you like"
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": "",
            "prompt": "I _____ to travel more often.",
            "options": [
              "'d like",
              "like",
              "enjoy"
            ]
          }
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Fill in the gaps using ‘d like or like(s), do you like or would you like.",
        "questions": [
          {
            "id": "q1",
            "before": "I ",
            "after": " to help her, but I can't.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "A: ",
            "after": " ice cream? B: Yes, I love it.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "I ",
            "after": " going on holiday with my family.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "I ",
            "after": " to go on holiday with my family this summer.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "What ",
            "after": " to watch tonight?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "A: ",
            "after": " some coffee? B: Yes, please.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "A: ",
            "after": " coffee? B: Not really. I prefer tea.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "When ",
            "after": " to visit us?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "I think he ",
            "after": " asking questions.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "We ",
            "after": " to ask you a few questions.",
            "options": [],
            "kind": "text"
          }
        ],
        "passage": [
          [
            {
              "text": "I "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " to help her, but I can't."
            }
          ],
          [
            {
              "text": "A: "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " ice cream? B: Yes, I love it."
            }
          ],
          [
            {
              "text": "I "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " going on holiday with my family."
            }
          ],
          [
            {
              "text": "I "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " to go on holiday with my family this summer."
            }
          ],
          [
            {
              "text": "What "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " to watch tonight?"
            }
          ],
          [
            {
              "text": "A: "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " some coffee? B: Yes, please."
            }
          ],
          [
            {
              "text": "A: "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " coffee? B: Not really. I prefer tea."
            }
          ],
          [
            {
              "text": "When "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " to visit us?"
            }
          ],
          [
            {
              "text": "I think he "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " asking questions."
            }
          ],
          [
            {
              "text": "We "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " to ask you a few questions."
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-have-got",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "Have got",
    "subtitle": "A1 grammar · all exercises",
    "cover": {
      "src": "/images/tests/a1-have-got-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: Have got"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Choose the correct verb forms to complete the sentences below.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": "",
            "prompt": "_____ a pen?",
            "options": [
              "Do you have got",
              "Have you got",
              "You have got"
            ]
          },
          {
            "id": "q2",
            "before": "",
            "after": "",
            "prompt": "They _____ any children.",
            "options": [
              "don't have got",
              "don't got",
              "haven't got"
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": "",
            "prompt": "A: 'Have you got a car?' B: 'Yes, I _____.'",
            "options": [
              "have",
              "do",
              "'ve got"
            ]
          },
          {
            "id": "q4",
            "before": "",
            "after": "",
            "prompt": "When we were kids, we _____ many toys.",
            "options": [
              "hadn't got",
              "didn't have",
              "hadn't"
            ]
          },
          {
            "id": "q5",
            "before": "",
            "after": "",
            "prompt": "He ____ a very nice family.",
            "options": [
              "'s got",
              "have got",
              "'ve got"
            ]
          },
          {
            "id": "q6",
            "before": "",
            "after": "",
            "prompt": "There is a door here. _____ the key?",
            "options": [
              "Have you got",
              "Do you got",
              "Do you have got"
            ]
          },
          {
            "id": "q7",
            "before": "",
            "after": "",
            "prompt": "They _____ two cats and two dogs.",
            "options": [
              "has got",
              "'ve",
              "'ve got"
            ]
          },
          {
            "id": "q8",
            "before": "",
            "after": "",
            "prompt": "_____ a question?",
            "options": [
              "Have you",
              "Do you have got",
              "Do you have"
            ]
          },
          {
            "id": "q9",
            "before": "",
            "after": "",
            "prompt": "I _____ the answer to your question.",
            "options": [
              "haven't",
              "don't have got",
              "haven't got"
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": "",
            "prompt": "I _____ a lot of money at the moment.",
            "options": [
              "don't have got",
              "don't have",
              "haven't"
            ]
          }
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Transform these sentences using the verb have got like in the example below. Use short forms when possible: ‘ve got, ‘s got, haven’t got, hasn’t got.",
        "questions": [
          {
            "id": "q1",
            "before": "I have a new computer. ⇒ I ",
            "after": " a new computer.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "Do you have a new profile photo? ⇒ ",
            "after": " a new profile photo?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "She has blonde hair and blue eyes. ⇒ She ",
            "after": " blonde hair and blue eyes.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "I don't have a Twitter account. ⇒ I ",
            "after": " a Twitter account.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "She doesn't have any money. ⇒ She ",
            "after": " any money.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "A: Do you have a laptop? B: Yes, I do. ⇒ A: Have you got a laptop? B: Yes, I ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "They have a lot of Youtube fans. ⇒ They ",
            "after": " a lot of Youtube fans.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "He doesn't have any interest in science. ⇒ He ",
            "after": " any interest in science.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "Does she have a sister? ⇒ ",
            "after": " a sister?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "I have a terrible headache. ⇒ I ",
            "after": " a terrible headache.",
            "options": [],
            "kind": "text"
          }
        ],
        "context": "EXAMPLE: They have a yacht ⇒ They ‘ve got a yacht.",
        "passage": [
          [
            {
              "text": "I have a new computer. ⇒ I "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " a new computer."
            }
          ],
          [
            {
              "text": "Do you have a new profile photo? ⇒ "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " a new profile photo?"
            }
          ],
          [
            {
              "text": "She has blonde hair and blue eyes. ⇒ She "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " blonde hair and blue eyes."
            }
          ],
          [
            {
              "text": "I don't have a Twitter account. ⇒ I "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " a Twitter account."
            }
          ],
          [
            {
              "text": "She doesn't have any money. ⇒ She "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " any money."
            }
          ],
          [
            {
              "text": "A: Do you have a laptop? B: Yes, I do. ⇒ A: Have you got a laptop? B: Yes, I "
            },
            {
              "questionId": "q6"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "They have a lot of Youtube fans. ⇒ They "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " a lot of Youtube fans."
            }
          ],
          [
            {
              "text": "He doesn't have any interest in science. ⇒ He "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " any interest in science."
            }
          ],
          [
            {
              "text": "Does she have a sister? ⇒ "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " a sister?"
            }
          ],
          [
            {
              "text": "I have a terrible headache. ⇒ I "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " a terrible headache."
            }
          ]
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Change the following sentences or questons into the past tense.",
        "questions": [
          {
            "id": "q1",
            "before": "He's got a girlfriend. ⇒ He ",
            "after": " a girlfriend.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "They haven't got any problems. ⇒ They ",
            "after": " any problems.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "Have you got a pen? ⇒ ",
            "after": " a pen?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "She hasn't got a sister. ⇒ She ",
            "after": " a sister.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "He's got an exam. ⇒ He ",
            "after": " an exam.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "Has she got a cold? ⇒ ",
            "after": " a cold?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "Have you got a headache? ⇒ ",
            "after": " a headache?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "I haven't got time. ⇒ I ",
            "after": " time.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "She's got a nice smile. ⇒ She ",
            "after": " a nice smile.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "He hasn't got much experience. ⇒ He ",
            "after": " much experience.",
            "options": [],
            "kind": "text"
          }
        ],
        "context": "EXAMPLE: They haven’t got a house ⇒ They didn’t have a house.",
        "passage": [
          [
            {
              "text": "He's got a girlfriend. ⇒ He "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " a girlfriend."
            }
          ],
          [
            {
              "text": "They haven't got any problems. ⇒ They "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " any problems."
            }
          ],
          [
            {
              "text": "Have you got a pen? ⇒ "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " a pen?"
            }
          ],
          [
            {
              "text": "She hasn't got a sister. ⇒ She "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " a sister."
            }
          ],
          [
            {
              "text": "He's got an exam. ⇒ He "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " an exam."
            }
          ],
          [
            {
              "text": "Has she got a cold? ⇒ "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " a cold?"
            }
          ],
          [
            {
              "text": "Have you got a headache? ⇒ "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " a headache?"
            }
          ],
          [
            {
              "text": "I haven't got time. ⇒ I "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " time."
            }
          ],
          [
            {
              "text": "She's got a nice smile. ⇒ She "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " a nice smile."
            }
          ],
          [
            {
              "text": "He hasn't got much experience. ⇒ He "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " much experience."
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-a-some-any-countable-uncountable",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "A, some, any: Countable and uncountable nouns",
    "subtitle": "A1 grammar · all exercises",
    "cover": {
      "src": "/images/tests/a1-a-some-any-countable-uncountable-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: A, some, any: Countable and uncountable nouns"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Choose a, some, any to complete the sentences below.",
        "questions": [
          {
            "id": "q1",
            "before": "I need ",
            "after": " information about the city.",
            "options": [
              "an",
              "any",
              "some"
            ]
          },
          {
            "id": "q2",
            "before": "I always have ",
            "after": " egg for breakfast.",
            "options": [
              "any",
              "an",
              "some"
            ]
          },
          {
            "id": "q3",
            "before": "Can you help me? I need ",
            "after": " advice.",
            "options": [
              "some",
              "any",
              "an"
            ]
          },
          {
            "id": "q4",
            "before": "We don't have ",
            "after": " money.",
            "options": [
              "some",
              "any",
              "a"
            ]
          },
          {
            "id": "q5",
            "before": "Can I have ",
            "after": " milk, please?",
            "options": [
              "a",
              "any",
              "some"
            ]
          },
          {
            "id": "q6",
            "before": "Have you got ",
            "after": " pen?",
            "options": [
              "a",
              "any",
              "some"
            ]
          },
          {
            "id": "q7",
            "before": "We didn't see ",
            "after": " people in the streets.",
            "options": [
              "any",
              "some",
              "a"
            ]
          },
          {
            "id": "q8",
            "before": "Does Peter have ",
            "after": " magazines in his office?",
            "options": [
              "some",
              "a",
              "any"
            ]
          },
          {
            "id": "q9",
            "before": "Do you want ",
            "after": " chips?",
            "options": [
              "some",
              "any",
              "a"
            ]
          },
          {
            "id": "q10",
            "before": "My wife doesn't want ",
            "after": " dog.",
            "options": [
              "any",
              "some",
              "a"
            ]
          }
        ],
        "passage": [
          [
            {
              "text": "I need "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " information about the city."
            }
          ],
          [
            {
              "text": "I always have "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " egg for breakfast."
            }
          ],
          [
            {
              "text": "Can you help me? I need "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " advice."
            }
          ],
          [
            {
              "text": "We don't have "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " money."
            }
          ],
          [
            {
              "text": "Can I have "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " milk, please?"
            }
          ],
          [
            {
              "text": "Have you got "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " pen?"
            }
          ],
          [
            {
              "text": "We didn't see "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " people in the streets."
            }
          ],
          [
            {
              "text": "Does Peter have "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " magazines in his office?"
            }
          ],
          [
            {
              "text": "Do you want "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " chips?"
            }
          ],
          [
            {
              "text": "My wife doesn't want "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " dog."
            }
          ]
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Choose the correct option to complete these sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": "",
            "prompt": "I didn't see _____ in the library.",
            "options": [
              "any classmates",
              "some classmates",
              "any classmate"
            ]
          },
          {
            "id": "q2",
            "before": "",
            "after": "",
            "prompt": "I have _____ in my house.",
            "options": [
              "some new furnitures",
              "a new furniture",
              "some new furniture"
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": "",
            "prompt": "Can I have _____ apple, please?",
            "options": [
              "an",
              "some",
              "any"
            ]
          },
          {
            "id": "q4",
            "before": "",
            "after": "",
            "prompt": "They gave me _____ for my collection.",
            "options": [
              "some old books",
              "an old books",
              "some old book"
            ]
          },
          {
            "id": "q5",
            "before": "",
            "after": "",
            "prompt": "The hotel where I'm staying has _____.",
            "options": [
              "swimming pool",
              "a swimming pool",
              "some swimming pool"
            ]
          },
          {
            "id": "q6",
            "before": "",
            "after": "",
            "prompt": "She speaks _____ English.",
            "options": [
              "some",
              "any",
              "an"
            ]
          },
          {
            "id": "q7",
            "before": "",
            "after": "",
            "prompt": "I didn't get _____ from you or your partner.",
            "options": [
              "an calls",
              "any calls",
              "any call"
            ]
          },
          {
            "id": "q8",
            "before": "",
            "after": "",
            "prompt": "Can you give me _____ bread?",
            "options": [
              "a",
              "any",
              "some"
            ]
          },
          {
            "id": "q9",
            "before": "",
            "after": "",
            "prompt": "Have you got _____?",
            "options": [
              "any brother or sister",
              "some brothers or sisters",
              "any brothers or sisters"
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": "",
            "prompt": "She gave me _____.",
            "options": [
              "a terrible new",
              "some terrible news",
              "a terrible news"
            ]
          }
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Complete the sentences using a, some, any and the words in the box.",
        "questions": [
          {
            "id": "q1",
            "before": "We visited ",
            "after": " during our trip to China.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "Mary has a DVD player, but she doesn't have ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "I'm not sure of what to do. Can you give me ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "I had some rice and ",
            "after": " for lunch.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "You can ask me now if you want. Do you have ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "I have ",
            "after": " with my boss. She hates me.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "It's very hot here. I need ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "Have you got ",
            "after": "? I need it for the coffee vending machine.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "I want to cook an omelette, but I don't have ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "Do you speak ",
            "after": "?",
            "options": [],
            "kind": "text"
          }
        ],
        "context": "advice – big problem – coin – DVDs – eggs – French – fresh air – nice cities – pen – questions – sausage EXAMPLE: Can you lend me ⇒ a pen to write the composition?",
        "passage": [
          [
            {
              "text": "We visited "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " during our trip to China."
            }
          ],
          [
            {
              "text": "Mary has a DVD player, but she doesn't have "
            },
            {
              "questionId": "q2"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "I'm not sure of what to do. Can you give me "
            },
            {
              "questionId": "q3"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "I had some rice and "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " for lunch."
            }
          ],
          [
            {
              "text": "You can ask me now if you want. Do you have "
            },
            {
              "questionId": "q5"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "I have "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " with my boss. She hates me."
            }
          ],
          [
            {
              "text": "It's very hot here. I need "
            },
            {
              "questionId": "q7"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "Have you got "
            },
            {
              "questionId": "q8"
            },
            {
              "text": "? I need it for the coffee vending machine."
            }
          ],
          [
            {
              "text": "I want to cook an omelette, but I don't have "
            },
            {
              "questionId": "q9"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "Do you speak "
            },
            {
              "questionId": "q10"
            },
            {
              "text": "?"
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-there-is-there-are",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "There is, there are / there was, there were",
    "subtitle": "A1 grammar · all exercises",
    "cover": {
      "src": "/images/tests/a1-there-is-there-are-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: There is, there are / there was, there were"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Complete the conversation below with there’s, there are, there isn’t, there aren’t, is there, are there. Use SHORT FORMS when possible.",
        "questions": [
          {
            "id": "q1",
            "before": "REAL ESTATE AGENT: Yes, of course. It's a very nice, big apartment.  ",
            "after": " three bedrooms.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "PHILLIP:  ",
            "after": " a bathroom in each bedroom?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "REAL ESTATE AGENT: No,  ",
            "after": ". The main bedroom has got a bathroom, but  … any bathrooms in the other two bedrooms.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "REAL ESTATE AGENT: No,  …. The main bedroom has got a bathroom, but  ",
            "after": " any bathrooms in the other two bedrooms.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "PHILLIP:  ",
            "after": " a dining room?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "REAL ESTATE AGENT: No,  ",
            "after": ", but there's a large living room with a dining area.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "PHILLIP:  ",
            "after": " any balconies?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "REAL ESTATE AGENT: No,  ",
            "after": ", I'm afraid.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "PHILLIP: And  ",
            "after": " a garage?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "REAL ESTATE AGENT: Yes,  ",
            "after": " a garage at the front of the house.",
            "options": [],
            "kind": "text"
          }
        ],
        "passage": [
          [
            {
              "text": "PHILLIP: Good morning. Can you give me some information about the house in St. Patrick's street?"
            }
          ],
          [
            {
              "text": "REAL ESTATE AGENT: Yes, of course. It's a very nice, big apartment.  "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " three bedrooms."
            }
          ],
          [
            {
              "text": "PHILLIP:  "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " a bathroom in each bedroom?"
            }
          ],
          [
            {
              "text": "REAL ESTATE AGENT: No,  "
            },
            {
              "questionId": "q3"
            },
            {
              "text": ". The main bedroom has got a bathroom, but  "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " any bathrooms in the other two bedrooms."
            }
          ],
          [
            {
              "text": "PHILLIP:  "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " a dining room?"
            }
          ],
          [
            {
              "text": "REAL ESTATE AGENT: No,  "
            },
            {
              "questionId": "q6"
            },
            {
              "text": ", but there's a large living room with a dining area."
            }
          ],
          [
            {
              "text": "PHILLIP:  "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " any balconies?"
            }
          ],
          [
            {
              "text": "REAL ESTATE AGENT: No,  "
            },
            {
              "questionId": "q8"
            },
            {
              "text": ", I'm afraid."
            }
          ],
          [
            {
              "text": "PHILLIP: And  "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " a garage?"
            }
          ],
          [
            {
              "text": "REAL ESTATE AGENT: Yes,  "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " a garage at the front of the house."
            }
          ]
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Choose the correct forms of there is, there are, it is, they are, to complete these sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": "",
            "prompt": "In my street, _____ a bakery, a supermarket and two restaurants.",
            "options": [
              "there's",
              "there are",
              "are there"
            ]
          },
          {
            "id": "q2",
            "before": "",
            "after": "",
            "prompt": "'Is there a new printer in the office?' 'Yes, ____.'",
            "options": [
              "there's",
              "there are",
              "there is"
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": "",
            "prompt": "When I opened the door, _____ a police officer standing in front of me.",
            "options": [
              "there were",
              "there was",
              "there is"
            ]
          },
          {
            "id": "q4",
            "before": "",
            "after": "",
            "prompt": "You can go now. _____ any danger.",
            "options": [
              "There isn't",
              "There is",
              "There aren't"
            ]
          },
          {
            "id": "q5",
            "before": "",
            "after": "",
            "prompt": "_____ any people in the restaurant last night?",
            "options": [
              "Was there",
              "Were there",
              "Are there"
            ]
          },
          {
            "id": "q6",
            "before": "",
            "after": "",
            "prompt": "_____ some money on the table.",
            "options": [
              "There's",
              "There isn't",
              "There are"
            ]
          },
          {
            "id": "q7",
            "before": "",
            "after": "",
            "prompt": "_____ many students in class yesterday.",
            "options": [
              "There aren't",
              "There wasn't",
              "There weren't"
            ]
          },
          {
            "id": "q8",
            "before": "",
            "after": "",
            "prompt": "'Are there many restaurants in your neighbourhood?' 'Yes, _____.'",
            "options": [
              "there is",
              "there're",
              "there are"
            ]
          },
          {
            "id": "q9",
            "before": "",
            "after": "",
            "prompt": "_____ milk and cookies in the kitchen.",
            "options": [
              "There are",
              "There is",
              "There aren't"
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": "",
            "prompt": "_____ a question in the exam that I couldn't answer.",
            "options": [
              "There is",
              "There was",
              "There were"
            ]
          }
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Complete the sentences using the affirmative, negative or interrogative forms of there + be in present or past.",
        "questions": [
          {
            "id": "q1",
            "before": "When I was young, ",
            "after": " a very good player in my team.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "",
            "after": " any good films on TV today.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "Everything was perfect. ",
            "after": " any problems.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "",
            "after": " many people at the cinema last night?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "Do you want to eat out? ",
            "after": " a new restaurant in the center.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "Why ",
            "after": " two boxes on the sofa? Can you take them away, please?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "Ten years ago, ",
            "after": " more shops; now many people buy online.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "I'm very hungry. ",
            "after": " any food left?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "Why ",
            "after": " a Civil War in the USA in 1861?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "We need to go shopping; ",
            "after": " any food in the fridge.",
            "options": [],
            "kind": "text"
          }
        ],
        "passage": [
          [
            {
              "text": "When I was young, "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " a very good player in my team."
            }
          ],
          [
            {
              "questionId": "q2"
            },
            {
              "text": " any good films on TV today."
            }
          ],
          [
            {
              "text": "Everything was perfect. "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " any problems."
            }
          ],
          [
            {
              "questionId": "q4"
            },
            {
              "text": " many people at the cinema last night?"
            }
          ],
          [
            {
              "text": "Do you want to eat out? "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " a new restaurant in the center."
            }
          ],
          [
            {
              "text": "Why "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " two boxes on the sofa? Can you take them away, please?"
            }
          ],
          [
            {
              "text": "Ten years ago, "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " more shops; now many people buy online."
            }
          ],
          [
            {
              "text": "I'm very hungry. "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " any food left?"
            }
          ],
          [
            {
              "text": "Why "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " a Civil War in the USA in 1861?"
            }
          ],
          [
            {
              "text": "We need to go shopping; "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " any food in the fridge."
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-there-it",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "There or It",
    "subtitle": "A1 grammar · all exercises",
    "cover": {
      "src": "/images/tests/a1-there-it-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: There or It"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Choose the correct there or it forms to complete the following sentences below.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": " is dangerous to drive at night.",
            "options": [
              "There",
              "It"
            ]
          },
          {
            "id": "q2",
            "before": "I opened the door and ",
            "after": " was a strange man behind it.",
            "options": [
              "there",
              "it"
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": " was a problem with the car. We took a taxi.",
            "options": [
              "It",
              "There"
            ]
          },
          {
            "id": "q4",
            "before": "I want to go home. ",
            "after": "'s late and I'm tired.",
            "options": [
              "It",
              "There"
            ]
          },
          {
            "id": "q5",
            "before": "",
            "after": " aren't any students in the classroom.",
            "options": [
              "There",
              "They"
            ]
          },
          {
            "id": "q6",
            "before": "I'm watching a new series. ",
            "after": "'s very good.",
            "options": [
              "It",
              "There"
            ]
          },
          {
            "id": "q7",
            "before": "",
            "after": " is very cold today.",
            "options": [
              "There",
              "It"
            ]
          },
          {
            "id": "q8",
            "before": "",
            "after": " is a new teacher at my school.",
            "options": [
              "There",
              "It"
            ]
          },
          {
            "id": "q9",
            "before": "There's a park opposite my house. ",
            "after": " is beautiful.",
            "options": [
              "It",
              "There"
            ]
          },
          {
            "id": "q10",
            "before": "They are in the classroom. ",
            "after": " is an exam now.",
            "options": [
              "There",
              "It"
            ]
          }
        ],
        "passage": [
          [
            {
              "questionId": "q1"
            },
            {
              "text": " is dangerous to drive at night."
            }
          ],
          [
            {
              "text": "I opened the door and "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " was a strange man behind it."
            }
          ],
          [
            {
              "questionId": "q3"
            },
            {
              "text": " was a problem with the car. We took a taxi."
            }
          ],
          [
            {
              "text": "I want to go home. "
            },
            {
              "questionId": "q4"
            },
            {
              "text": "'s late and I'm tired."
            }
          ],
          [
            {
              "questionId": "q5"
            },
            {
              "text": " aren't any students in the classroom."
            }
          ],
          [
            {
              "text": "I'm watching a new series. "
            },
            {
              "questionId": "q6"
            },
            {
              "text": "'s very good."
            }
          ],
          [
            {
              "questionId": "q7"
            },
            {
              "text": " is very cold today."
            }
          ],
          [
            {
              "questionId": "q8"
            },
            {
              "text": " is a new teacher at my school."
            }
          ],
          [
            {
              "text": "There's a park opposite my house. "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " is beautiful."
            }
          ],
          [
            {
              "text": "They are in the classroom. "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " is an exam now."
            }
          ]
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Choose the correct there or it forms.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": "",
            "prompt": "____ was sunny when we arrived.",
            "options": [
              "There",
              "It"
            ]
          },
          {
            "id": "q2",
            "before": "",
            "after": "",
            "prompt": "_____ is a long way from here to the shops.",
            "options": [
              "There",
              "It"
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": "",
            "prompt": "Is _____ any milk in the fridge?",
            "options": [
              "there",
              "it"
            ]
          },
          {
            "id": "q4",
            "before": "",
            "after": "",
            "prompt": "We didn't understand. _____ was a lot of confusion.",
            "options": [
              "There",
              "It"
            ]
          },
          {
            "id": "q5",
            "before": "",
            "after": "",
            "prompt": "Go back to sleep. _____ 's early.",
            "options": [
              "There",
              "It"
            ]
          },
          {
            "id": "q6",
            "before": "",
            "after": "",
            "prompt": "_____ snows a lot in winter.",
            "options": [
              "There",
              "It"
            ]
          },
          {
            "id": "q7",
            "before": "",
            "after": "",
            "prompt": "_____ was a terrible fire last year.",
            "options": [
              "There",
              "It"
            ]
          },
          {
            "id": "q8",
            "before": "",
            "after": "",
            "prompt": "_____ is important to answer all the questions.",
            "options": [
              "There",
              "It"
            ]
          },
          {
            "id": "q9",
            "before": "",
            "after": "",
            "prompt": "Let's not go to the park. _____ is very windy today.",
            "options": [
              "There",
              "It"
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": "",
            "prompt": "_____ is a concert this weekend.",
            "options": [
              "There",
              "It"
            ]
          }
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Complete the sentences using there, it or they.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": " were a lot of people at the party.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "",
            "after": " are two new students in my class. … are from Brazil.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "… are two new students in my class. ",
            "after": " are from Brazil.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "Can you give me my bag? ",
            "after": " is on the sofa.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "Are ",
            "after": " any good hotels in this town?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "",
            "after": " is late and … are a lot of things that I need to do.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "… is late and ",
            "after": " are a lot of things that I need to do.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "There's a new swimming pool. ",
            "after": "'s very big.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "",
            "after": " is so nice to be here.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "I saw two people outside. ",
            "after": " were my parents.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q11",
            "before": "",
            "after": " is very late. How far is …?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q12",
            "before": "… is very late. How far is ",
            "after": "?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q13",
            "before": "",
            "after": " were some problems last week.",
            "options": [],
            "kind": "text"
          }
        ],
        "passage": [
          [
            {
              "questionId": "q1"
            },
            {
              "text": " were a lot of people at the party."
            }
          ],
          [
            {
              "questionId": "q2"
            },
            {
              "text": " are two new students in my class. "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " are from Brazil."
            }
          ],
          [
            {
              "text": "Can you give me my bag? "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " is on the sofa."
            }
          ],
          [
            {
              "text": "Are "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " any good hotels in this town?"
            }
          ],
          [
            {
              "questionId": "q6"
            },
            {
              "text": " is late and "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " are a lot of things that I need to do."
            }
          ],
          [
            {
              "text": "There's a new swimming pool. "
            },
            {
              "questionId": "q8"
            },
            {
              "text": "'s very big."
            }
          ],
          [
            {
              "questionId": "q9"
            },
            {
              "text": " is so nice to be here."
            }
          ],
          [
            {
              "text": "I saw two people outside. "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " were my parents."
            }
          ],
          [
            {
              "questionId": "q11"
            },
            {
              "text": " is very late. How far is "
            },
            {
              "questionId": "q12"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "questionId": "q13"
            },
            {
              "text": " were some problems last week."
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-next-to-under-between-in-front-behind-etc",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "Next to, under, between, in front of, behind, over, etc.",
    "subtitle": "A1 grammar · all exercises",
    "cover": {
      "src": "/images/tests/a1-next-to-under-between-in-front-behind-etc-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: Next to, under, between, in front of, behind, over, etc."
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Look at the pictures and choose the correct prepositions of place.",
        "questions": [
          {
            "id": "q1",
            "before": "There is a cat ",
            "after": " the table.",
            "options": [
              "above",
              "between",
              "behind",
              "next to",
              "under"
            ]
          },
          {
            "id": "q2",
            "before": "The woman is sleeping ",
            "after": " the books.",
            "options": [
              "next to",
              "in front of",
              "above",
              "behind",
              "under"
            ]
          },
          {
            "id": "q3",
            "before": "There are some clouds ",
            "after": " the building.",
            "options": [
              "above",
              "behind",
              "under",
              "beside",
              "opposite"
            ]
          },
          {
            "id": "q4",
            "before": "Janet is sitting ",
            "after": " Tom.",
            "options": [
              "between",
              "opposite",
              "next to",
              "behind",
              "in front of"
            ]
          },
          {
            "id": "q5",
            "before": "There is a cat ",
            "after": " the dogs.",
            "options": [
              "under",
              "between",
              "in front of",
              "above",
              "beside"
            ]
          },
          {
            "id": "q6",
            "before": "Janet is sitting ",
            "after": " Tom.",
            "options": [
              "behind",
              "in front of",
              "next to",
              "between",
              "opposite"
            ]
          },
          {
            "id": "q7",
            "before": "Janet is sitting ",
            "after": " a blond woman.",
            "options": [
              "opposite",
              "behind",
              "beside",
              "in front of",
              "above"
            ]
          },
          {
            "id": "q8",
            "before": "Linda is sitting ",
            "after": " Jack and Harry.",
            "options": [
              "behind",
              "above",
              "opposite",
              "between",
              "next to"
            ]
          },
          {
            "id": "q9",
            "before": "The ball is ",
            "after": " the net.",
            "options": [
              "over",
              "behind",
              "in front of",
              "beside",
              "under"
            ]
          },
          {
            "id": "q10",
            "before": "The dog is standing ",
            "after": " the cat.",
            "options": [
              "opposite",
              "in front of",
              "behind",
              "between",
              "next to"
            ]
          }
        ],
        "passage": [
          [
            {
              "text": "There is a cat "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " the table."
            }
          ],
          [
            {
              "text": "The woman is sleeping "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " the books."
            }
          ],
          [
            {
              "text": "There are some clouds "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " the building."
            }
          ],
          [
            {
              "text": "Janet is sitting "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " Tom."
            }
          ],
          [
            {
              "text": "There is a cat "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " the dogs."
            }
          ],
          [
            {
              "text": "Janet is sitting "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " Tom."
            }
          ],
          [
            {
              "text": "Janet is sitting "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " a blond woman."
            }
          ],
          [
            {
              "text": "Linda is sitting "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " Jack and Harry."
            }
          ],
          [
            {
              "text": "The ball is "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " the net."
            }
          ],
          [
            {
              "text": "The dog is standing "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " the cat."
            }
          ]
        ],
        "images": [
          {
            "src": "/images/tests/a1-exercises/a1-next-to-under-between-in-front-behind-etc-1-prepositions-of-place-exercise1.png",
            "alt": "Exercise illustration",
            "width": 500,
            "height": 278
          }
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Choose the correct preposition of place to complete these sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": "",
            "prompt": "The ball is _____ the dog.",
            "options": [
              "in front of",
              "beside",
              "between",
              "opposite",
              "under"
            ],
            "images": [
              {
                "src": "/images/tests/a1-exercises/a1-next-to-under-between-in-front-behind-etc-2-dog-beside.png",
                "alt": "Illustration for question 1",
                "width": 150,
                "height": 150
              }
            ]
          },
          {
            "id": "q2",
            "before": "",
            "after": "",
            "prompt": "The ball is _____ the dog.",
            "options": [
              "in front of",
              "beside",
              "above",
              "behind",
              "opposite"
            ],
            "images": [
              {
                "src": "/images/tests/a1-exercises/a1-next-to-under-between-in-front-behind-etc-2-dog-above.png",
                "alt": "Illustration for question 2",
                "width": 150,
                "height": 150
              }
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": "",
            "prompt": "The dog is _____ the cat.",
            "options": [
              "in front of",
              "next to",
              "above",
              "behind",
              "opposite"
            ],
            "images": [
              {
                "src": "/images/tests/a1-exercises/a1-next-to-under-between-in-front-behind-etc-2-dog-opposite.png",
                "alt": "Illustration for question 3",
                "width": 150,
                "height": 150
              }
            ]
          },
          {
            "id": "q4",
            "before": "",
            "after": "",
            "prompt": "The dog is _____ the ball.",
            "options": [
              "in front of",
              "beside",
              "between",
              "under",
              "behind"
            ],
            "images": [
              {
                "src": "/images/tests/a1-exercises/a1-next-to-under-between-in-front-behind-etc-2-dog-front.png",
                "alt": "Illustration for question 4",
                "width": 150,
                "height": 150
              }
            ]
          },
          {
            "id": "q5",
            "before": "",
            "after": "",
            "prompt": "The ball is _____ the dog.",
            "options": [
              "in front of",
              "opposite",
              "between",
              "next to",
              "behind"
            ],
            "images": [
              {
                "src": "/images/tests/a1-exercises/a1-next-to-under-between-in-front-behind-etc-2-dog-front.png",
                "alt": "Illustration for question 5",
                "width": 150,
                "height": 150
              }
            ]
          },
          {
            "id": "q6",
            "before": "",
            "after": "",
            "prompt": "The ball is _____ the dog.",
            "options": [
              "beside",
              "over",
              "under",
              "behind",
              "opposite"
            ],
            "images": [
              {
                "src": "/images/tests/a1-exercises/a1-next-to-under-between-in-front-behind-etc-2-dog-under.png",
                "alt": "Illustration for question 6",
                "width": 150,
                "height": 150
              }
            ]
          },
          {
            "id": "q7",
            "before": "",
            "after": "",
            "prompt": "The dog is _____ the ball.",
            "options": [
              "behind",
              "next to",
              "under",
              "over",
              "between"
            ],
            "images": [
              {
                "src": "/images/tests/a1-exercises/a1-next-to-under-between-in-front-behind-etc-2-dog-beside.png",
                "alt": "Illustration for question 7",
                "width": 150,
                "height": 150
              }
            ]
          },
          {
            "id": "q8",
            "before": "",
            "after": "",
            "prompt": "The bear is _____ the blanket.",
            "options": [
              "under",
              "above",
              "behind",
              "beside",
              "between"
            ],
            "images": [
              {
                "src": "/images/tests/a1-exercises/a1-next-to-under-between-in-front-behind-etc-2-bear-blanket.png",
                "alt": "Illustration for question 8",
                "width": 150,
                "height": 150
              }
            ]
          },
          {
            "id": "q9",
            "before": "",
            "after": "",
            "prompt": "The ball is _____ the dog.",
            "options": [
              "in front of",
              "next to",
              "under",
              "over",
              "behind"
            ],
            "images": [
              {
                "src": "/images/tests/a1-exercises/a1-next-to-under-between-in-front-behind-etc-2-dog-above.png",
                "alt": "Illustration for question 9",
                "width": 150,
                "height": 150
              }
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": "",
            "prompt": "The dog is _____ the balls.",
            "options": [
              "behind",
              "between",
              "under",
              "next to",
              "opposite"
            ],
            "images": [
              {
                "src": "/images/tests/a1-exercises/a1-next-to-under-between-in-front-behind-etc-2-between.png",
                "alt": "Illustration for question 10",
                "width": 173,
                "height": 80
              }
            ]
          }
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Write the correct preposition of place in each gap. You must use all the prepositions in the table below.",
        "questions": [
          {
            "id": "q1",
            "before": "Diego is standing ",
            "after": " Laura (2).",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "Laura is standing ",
            "after": " the table (6).",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "The pans are hanging ",
            "after": " the table (6).",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "David is standing ",
            "after": " Martha (5).",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "Martha is standing ",
            "after": " David (4).",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "The table is ",
            "after": " the pans (3).",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "The painting is ",
            "after": " Martha (5).",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "The red chilies are hanging ",
            "after": " the cooker.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "You can see Martin ",
            "after": " Diego (1) and Laura (2).",
            "options": [],
            "kind": "text"
          }
        ],
        "context": "above – behind – beside – between – in front of – next to – opposite – over – under",
        "passage": [
          [
            {
              "text": "Diego is standing "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " Laura (2)."
            }
          ],
          [
            {
              "text": "Laura is standing "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " the table (6)."
            }
          ],
          [
            {
              "text": "The pans are hanging "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " the table (6)."
            }
          ],
          [
            {
              "text": "David is standing "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " Martha (5)."
            }
          ],
          [
            {
              "text": "Martha is standing "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " David (4)."
            }
          ],
          [
            {
              "text": "The table is "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " the pans (3)."
            }
          ],
          [
            {
              "text": "The painting is "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " Martha (5)."
            }
          ],
          [
            {
              "text": "The red chilies are hanging "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " the cooker."
            }
          ],
          [
            {
              "text": "You can see Martin "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " Diego (1) and Laura (2)."
            }
          ]
        ],
        "images": [
          {
            "src": "/images/tests/a1-exercises/a1-next-to-under-between-in-front-behind-etc-3-prepositions-of-place-exercise_3.png",
            "alt": "prepositions-of-place-exercise_3",
            "width": 500,
            "height": 352
          }
        ]
      }
    ]
  },
  {
    "id": "a1-much-many-lot-little-few",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "Much, many, a lot of, a little, a few",
    "subtitle": "A1 grammar · all exercises",
    "cover": {
      "src": "/images/tests/a1-much-many-lot-little-few-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: Much, many, a lot of, a little, a few"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Choose much, many, a lot of, a little, a few, etc. to complete the sentences",
        "questions": [
          {
            "id": "q1",
            "before": "If I want to pass the exam, I need to study ",
            "after": ".",
            "options": [
              "many",
              "a lot of",
              "a lot"
            ]
          },
          {
            "id": "q2",
            "before": "There aren't ",
            "after": " things to do in this village.",
            "options": [
              "a lot",
              "many",
              "much"
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": " sugar do you take in your tea?",
            "options": [
              "How much",
              "How little",
              "How many"
            ]
          },
          {
            "id": "q4",
            "before": "There was ",
            "after": " tension at the meeting.",
            "options": [
              "much",
              "many",
              "a lot of"
            ]
          },
          {
            "id": "q5",
            "before": "Dad, I need ",
            "after": " money for school.",
            "options": [
              "a few",
              "many",
              "a little"
            ]
          },
          {
            "id": "q6",
            "before": "There are ",
            "after": " things that you can do to improve your writing.",
            "options": [
              "any",
              "a few",
              "a little"
            ]
          },
          {
            "id": "q7",
            "before": "There is ",
            "after": " milk in the fridge. We need to buy some.",
            "options": [
              "none",
              "any",
              "no"
            ]
          },
          {
            "id": "q8",
            "before": "He doesn't have ",
            "after": " hobbies.",
            "options": [
              "none",
              "any",
              "no"
            ]
          },
          {
            "id": "q9",
            "before": "'How many computers do you have?' '",
            "after": ".'",
            "options": [
              "None",
              "Any",
              "No"
            ]
          },
          {
            "id": "q10",
            "before": "I can help you; I have ",
            "after": " time today.",
            "options": [
              "a lot of",
              "much",
              "many"
            ]
          }
        ],
        "passage": [
          [
            {
              "text": "If I want to pass the exam, I need to study "
            },
            {
              "questionId": "q1"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "There aren't "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " things to do in this village."
            }
          ],
          [
            {
              "questionId": "q3"
            },
            {
              "text": " sugar do you take in your tea?"
            }
          ],
          [
            {
              "text": "There was "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " tension at the meeting."
            }
          ],
          [
            {
              "text": "Dad, I need "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " money for school."
            }
          ],
          [
            {
              "text": "There are "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " things that you can do to improve your writing."
            }
          ],
          [
            {
              "text": "There is "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " milk in the fridge. We need to buy some."
            }
          ],
          [
            {
              "text": "He doesn't have "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " hobbies."
            }
          ],
          [
            {
              "text": "'How many computers do you have?' '"
            },
            {
              "questionId": "q9"
            },
            {
              "text": ".'"
            }
          ],
          [
            {
              "text": "I can help you; I have "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " time today."
            }
          ]
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Choose the correct words much, many, a lot of, a little, a few, to complete these sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": "",
            "prompt": "'How much water do you drink?' '_____.'",
            "options": [
              "Much",
              "A lot of",
              "A lot"
            ]
          },
          {
            "id": "q2",
            "before": "",
            "after": "",
            "prompt": "_____ goals did they score?",
            "options": [
              "How many",
              "How much",
              "How little"
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": "",
            "prompt": "Nowadays we don't use _____ cash, because we use our credit cards.",
            "options": [
              "many",
              "much",
              "a lot"
            ]
          },
          {
            "id": "q4",
            "before": "",
            "after": "",
            "prompt": "There's _____ pressure on the players.",
            "options": [
              "a lot of",
              "much",
              "many"
            ]
          },
          {
            "id": "q5",
            "before": "",
            "after": "",
            "prompt": "They got married _____ months after they met for the first time.",
            "options": [
              "much",
              "a little",
              "a few"
            ]
          },
          {
            "id": "q6",
            "before": "",
            "after": "",
            "prompt": "'How much milk do you want in your coffee?' 'Only _____.'",
            "options": [
              "a little",
              "a few",
              "much"
            ]
          },
          {
            "id": "q7",
            "before": "",
            "after": "",
            "prompt": "There were _____ problems during the festival.",
            "options": [
              "any",
              "no",
              "none"
            ]
          },
          {
            "id": "q8",
            "before": "",
            "after": "",
            "prompt": "I don't want _____ gifts.",
            "options": [
              "none",
              "no",
              "any"
            ]
          },
          {
            "id": "q9",
            "before": "",
            "after": "",
            "prompt": "'How many gifts do you want?' '_____.'",
            "options": [
              "None",
              "Any",
              "No"
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": "",
            "prompt": "I eat _____ vegetables.",
            "options": [
              "much",
              "a lot of",
              "many"
            ]
          }
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Complete the sentences using these words.",
        "questions": [
          {
            "id": "q1",
            "before": "He has ",
            "after": " paintings. It's a really big collection.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "",
            "after": " salt do you put in your food?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "I normally use ",
            "after": " makeup, but not much, only some lipstick.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "It rained ",
            "after": " last week; it rained every day.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "They only scored one goal. They didn't have ",
            "after": " opportunities to score; maybe two or three.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "Please, I just need 5 minutes of your time. I only have ",
            "after": " questions.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "We had ",
            "after": " problems. It was 100% perfect.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "We need to be fast; we haven't got ",
            "after": " time, only 20 minutes.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "I didn't see ",
            "after": " people in the room. It was completely empty.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "'How many cups of coffee did you have?' '",
            "after": ". I don't drink coffee.'",
            "options": [],
            "kind": "text"
          }
        ],
        "context": "much – how much – many – how many – a lot of – a lot – a little – a few – any – no – none EXAMPLE: How many hours did you work yesterday?",
        "passage": [
          [
            {
              "text": "He has "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " paintings. It's a really big collection."
            }
          ],
          [
            {
              "questionId": "q2"
            },
            {
              "text": " salt do you put in your food?"
            }
          ],
          [
            {
              "text": "I normally use "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " makeup, but not much, only some lipstick."
            }
          ],
          [
            {
              "text": "It rained "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " last week; it rained every day."
            }
          ],
          [
            {
              "text": "They only scored one goal. They didn't have "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " opportunities to score; maybe two or three."
            }
          ],
          [
            {
              "text": "Please, I just need 5 minutes of your time. I only have "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " questions."
            }
          ],
          [
            {
              "text": "We had "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " problems. It was 100% perfect."
            }
          ],
          [
            {
              "text": "We need to be fast; we haven't got "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " time, only 20 minutes."
            }
          ],
          [
            {
              "text": "I didn't see "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " people in the room. It was completely empty."
            }
          ],
          [
            {
              "text": "'How many cups of coffee did you have?' '"
            },
            {
              "questionId": "q10"
            },
            {
              "text": ". I don't drink coffee.'"
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-comparative-adjectives",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "Comparative adjectives: Older than, more important than, etc.",
    "subtitle": "A1 grammar · all exercises",
    "cover": {
      "src": "/images/tests/a1-comparative-adjectives-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: Comparative adjectives: Older than, more important than, etc."
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Write the opposite of these adjectives. Use the comparative form of adjectives in the box below.",
        "questions": [
          {
            "id": "q1",
            "before": "younger ⇒ ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "colder ⇒ ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "better ⇒ ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "thinner ⇒ ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "cheaper ⇒ ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "nearer ⇒ ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "sadder ⇒ ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "smaller ⇒ ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "easier ⇒ ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "taller ⇒ ",
            "after": "",
            "options": [],
            "kind": "text"
          }
        ],
        "context": "bad – big – difficult – expensive – far – fat – happy – hot – old – short",
        "passage": [
          [
            {
              "text": "younger ⇒ "
            },
            {
              "questionId": "q1"
            }
          ],
          [
            {
              "text": "colder ⇒ "
            },
            {
              "questionId": "q2"
            }
          ],
          [
            {
              "text": "better ⇒ "
            },
            {
              "questionId": "q3"
            }
          ],
          [
            {
              "text": "thinner ⇒ "
            },
            {
              "questionId": "q4"
            }
          ],
          [
            {
              "text": "cheaper ⇒ "
            },
            {
              "questionId": "q5"
            }
          ],
          [
            {
              "text": "nearer ⇒ "
            },
            {
              "questionId": "q6"
            }
          ],
          [
            {
              "text": "sadder ⇒ "
            },
            {
              "questionId": "q7"
            }
          ],
          [
            {
              "text": "smaller ⇒ "
            },
            {
              "questionId": "q8"
            }
          ],
          [
            {
              "text": "easier ⇒ "
            },
            {
              "questionId": "q9"
            }
          ],
          [
            {
              "text": "taller ⇒ "
            },
            {
              "questionId": "q10"
            }
          ]
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Choose the correct comparative adjectives to complete these sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": "",
            "prompt": "My brother is older than _____.",
            "options": [
              "me",
              "mine",
              "my"
            ]
          },
          {
            "id": "q2",
            "before": "",
            "after": "",
            "prompt": "We are better _____.",
            "options": [
              "than them",
              "than their",
              "that them"
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": "",
            "prompt": "Travelling by bus is _____ travelling by car.",
            "options": [
              "comfortabler than",
              "more comfortable that",
              "more comfortable than"
            ]
          },
          {
            "id": "q4",
            "before": "",
            "after": "",
            "prompt": "The last test was more difficult than this test. This test is _____.",
            "options": [
              "less difficult",
              "dificultless",
              "less difficult than"
            ]
          },
          {
            "id": "q5",
            "before": "",
            "after": "",
            "prompt": "This exam was _____ the last one.",
            "options": [
              "more easy",
              "easier than",
              "more easier than"
            ]
          },
          {
            "id": "q6",
            "before": "",
            "after": "",
            "prompt": "Robert is _____ than his opponent.",
            "options": [
              "very stronger",
              "much strong",
              "much stronger"
            ]
          },
          {
            "id": "q7",
            "before": "",
            "after": "",
            "prompt": "Kevin is funny, but George is ____.",
            "options": [
              "more funny than",
              "funnier",
              "funnier than"
            ]
          },
          {
            "id": "q8",
            "before": "",
            "after": "",
            "prompt": "Your house is far, but my house is _____.",
            "options": [
              "more far",
              "farer",
              "further"
            ]
          },
          {
            "id": "q9",
            "before": "",
            "after": "",
            "prompt": "Kate is _____ than her sister.",
            "options": [
              "friendly",
              "friendlier",
              "more friendlier"
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": "",
            "prompt": "Everybody hates him. He really thinks that women are _____ men.",
            "options": [
              "intelligentless than",
              "less intelligent that",
              "less intelligent than"
            ]
          }
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Write comparative adjectives using the adjectives in brackets. Include than when necessary",
        "questions": [
          {
            "id": "q1",
            "before": "I like the black sofa, but I think the brown sofa is ",
            "after": " (comfortable).",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "This bar is ",
            "after": " (noisy) the bars in my street.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "Marseille is much ",
            "after": " (hot) Paris.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "The helicopter was loud, but the ambulance was ",
            "after": " (loud).",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "Do you think Manchester United is ",
            "after": " (good) Manchester City this year?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "The novel is much ",
            "after": " (interesting) the film.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "Canadians are ",
            "after": " (rich) in the past.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "This summer was ",
            "after": " (wet) last summer.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "I liked the old version of the game, but the new version is much ",
            "after": " (exciting).",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "Sorry, 8 o'clock is very late. Can we meet a bit ",
            "after": " (early)?",
            "options": [],
            "kind": "text"
          }
        ],
        "passage": [
          [
            {
              "text": "I like the black sofa, but I think the brown sofa is "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " (comfortable)."
            }
          ],
          [
            {
              "text": "This bar is "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " (noisy) the bars in my street."
            }
          ],
          [
            {
              "text": "Marseille is much "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " (hot) Paris."
            }
          ],
          [
            {
              "text": "The helicopter was loud, but the ambulance was "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " (loud)."
            }
          ],
          [
            {
              "text": "Do you think Manchester United is "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " (good) Manchester City this year?"
            }
          ],
          [
            {
              "text": "The novel is much "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " (interesting) the film."
            }
          ],
          [
            {
              "text": "Canadians are "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " (rich) in the past."
            }
          ],
          [
            {
              "text": "This summer was "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " (wet) last summer."
            }
          ],
          [
            {
              "text": "I liked the old version of the game, but the new version is much "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " (exciting)."
            }
          ],
          [
            {
              "text": "Sorry, 8 o'clock is very late. Can we meet a bit "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " (early)?"
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-superlative-adjectives",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "Superlative adjectives: The oldest, the most important, etc.",
    "subtitle": "A1 grammar · all exercises",
    "cover": {
      "src": "/images/tests/a1-superlative-adjectives-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: Superlative adjectives: The oldest, the most important, etc."
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Write the superlative forms of these adjectives.",
        "questions": [
          {
            "id": "q1",
            "before": "young ⇒ ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "sad ⇒ ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "remote ⇒ ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "smelly ⇒ ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "bad ⇒ ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "amazing ⇒ ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "pretty ⇒ ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "flat ⇒ ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "short ⇒ ",
            "after": "",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "exciting ⇒ ",
            "after": "",
            "options": [],
            "kind": "text"
          }
        ],
        "context": "EXAMPLE: poor ⇒ the poorest",
        "passage": [
          [
            {
              "text": "young ⇒ "
            },
            {
              "questionId": "q1"
            }
          ],
          [
            {
              "text": "sad ⇒ "
            },
            {
              "questionId": "q2"
            }
          ],
          [
            {
              "text": "remote ⇒ "
            },
            {
              "questionId": "q3"
            }
          ],
          [
            {
              "text": "smelly ⇒ "
            },
            {
              "questionId": "q4"
            }
          ],
          [
            {
              "text": "bad ⇒ "
            },
            {
              "questionId": "q5"
            }
          ],
          [
            {
              "text": "amazing ⇒ "
            },
            {
              "questionId": "q6"
            }
          ],
          [
            {
              "text": "pretty ⇒ "
            },
            {
              "questionId": "q7"
            }
          ],
          [
            {
              "text": "flat ⇒ "
            },
            {
              "questionId": "q8"
            }
          ],
          [
            {
              "text": "short ⇒ "
            },
            {
              "questionId": "q9"
            }
          ],
          [
            {
              "text": "exciting ⇒ "
            },
            {
              "questionId": "q10"
            }
          ]
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Choose the correct superlative or comparative forms to complete these sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": "",
            "prompt": "Which is _____ planet from the sun?",
            "options": [
              "the farest",
              "the most far",
              "the farthest"
            ]
          },
          {
            "id": "q2",
            "before": "",
            "after": "",
            "prompt": "_____ the world lives in Indonesia.",
            "options": [
              "The oldest man of",
              "The oldest man in",
              "The most old man of"
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": "",
            "prompt": "David is very good at playing football, but Jason is _____.",
            "options": [
              "best",
              "the best",
              "better"
            ]
          },
          {
            "id": "q4",
            "before": "",
            "after": "",
            "prompt": "It was _____ day of my life.",
            "options": [
              "the most happy",
              "the most happiest",
              "the happiest"
            ]
          },
          {
            "id": "q5",
            "before": "",
            "after": "",
            "prompt": "What is _____ phone on the market?",
            "options": [
              "the thinnest",
              "thinnest",
              "the most thin"
            ]
          },
          {
            "id": "q6",
            "before": "",
            "after": "",
            "prompt": "Last summer was _____ season ever recorded.",
            "options": [
              "the dryest",
              "the most dry",
              "the driest"
            ]
          },
          {
            "id": "q7",
            "before": "",
            "after": "",
            "prompt": "I'm 10 years _____ than my wife.",
            "options": [
              "oldest",
              "the oldest",
              "older"
            ]
          },
          {
            "id": "q8",
            "before": "",
            "after": "",
            "prompt": "He is _____ person in my life.",
            "options": [
              "the most important",
              "the more important",
              "the importantest"
            ]
          },
          {
            "id": "q9",
            "before": "",
            "after": "",
            "prompt": "Our graduates earn _____ salaries in every U.S. state.",
            "options": [
              "the higher",
              "the highest",
              "the most high"
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": "",
            "prompt": "That was _____ moment of my life.",
            "options": [
              "the sadest",
              "the saddest",
              "the most sad"
            ]
          }
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Write superlative adjectives using the adjectives in brackets. Include the.",
        "questions": [
          {
            "id": "q1",
            "before": "July is ",
            "after": " (dry) month in southern Spain. It hardly ever rains.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "One World Trade Center is ",
            "after": " (tall) building in New York.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "She is ",
            "after": " (healthy) person I know.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "Egypt is one of ",
            "after": " (ancient) civilizations.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "He was ",
            "after": " (fast) runner in 2017.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "What month is ",
            "after": " (hot) in Scotland?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "She described her year in Singapore as ",
            "after": " (amazing) experience of her life.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "What is ",
            "after": " (bad) neighbourhood in London?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "It was ",
            "after": " (slow) car on the circuit.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "We sell ",
            "after": " (red) and most perfect apples.",
            "options": [],
            "kind": "text"
          }
        ],
        "context": "EXAMPLE: She is the most intelligent (intelligent) student in my class.",
        "passage": [
          [
            {
              "text": "July is "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " (dry) month in southern Spain. It hardly ever rains."
            }
          ],
          [
            {
              "text": "One World Trade Center is "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " (tall) building in New York."
            }
          ],
          [
            {
              "text": "She is "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " (healthy) person I know."
            }
          ],
          [
            {
              "text": "Egypt is one of "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " (ancient) civilizations."
            }
          ],
          [
            {
              "text": "He was "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " (fast) runner in 2017."
            }
          ],
          [
            {
              "text": "What month is "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " (hot) in Scotland?"
            }
          ],
          [
            {
              "text": "She described her year in Singapore as "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " (amazing) experience of her life."
            }
          ],
          [
            {
              "text": "What is "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " (bad) neighbourhood in London?"
            }
          ],
          [
            {
              "text": "It was "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " (slow) car on the circuit."
            }
          ],
          [
            {
              "text": "We sell "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " (red) and most perfect apples."
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-will-and-shall",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "'Will' and 'shall': Future",
    "subtitle": "A1 grammar · all exercises",
    "cover": {
      "src": "/images/tests/a1-will-and-shall-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: 'Will' and 'shall': Future"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Complete the sentences with I will (I’ll), Shall I or Shall we.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": "",
            "prompt": "A: I'm hungry. B: _____ make some bacon and eggs.",
            "options": [
              "I'll",
              "Shall I",
              "Shall we"
            ]
          },
          {
            "id": "q2",
            "before": "",
            "after": "",
            "prompt": "I hope _____ see you again one day.",
            "options": [
              "I'll",
              "Shall I",
              "Shall we"
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": "",
            "prompt": "A: _____ go to a restaurant tonight? B: Yes. That's a great idea.",
            "options": [
              "I'll",
              "Shall I",
              "Shall we"
            ]
          },
          {
            "id": "q4",
            "before": "",
            "after": "",
            "prompt": "I don't think _____ go out this weekend. I'm very tired.",
            "options": [
              "I'll",
              "Shall I",
              "Shall we"
            ]
          },
          {
            "id": "q5",
            "before": "",
            "after": "",
            "prompt": "_____ always love you.",
            "options": [
              "I will",
              "Shall I",
              "Shall we"
            ]
          },
          {
            "id": "q6",
            "before": "",
            "after": "",
            "prompt": "A: It's very hot in this room. B: _____ open the windows?",
            "options": [
              "I'll",
              "Shall I",
              "Shall we"
            ]
          },
          {
            "id": "q7",
            "before": "",
            "after": "",
            "prompt": "A: _____ have a barbecue on Saturday? B: That's an excellent idea! Who shall we invite?",
            "options": [
              "I will",
              "Shall I",
              "Shall we"
            ]
          },
          {
            "id": "q8",
            "before": "",
            "after": "",
            "prompt": "You look thirsty. _____ get you a drink?",
            "options": [
              "I'll",
              "Shall I",
              "Shall we"
            ]
          },
          {
            "id": "q9",
            "before": "",
            "after": "",
            "prompt": "A: Did you talk to Laura? B: Oh no, I forgot. _____ call her now.",
            "options": [
              "I'll",
              "Shall I",
              "Shall we"
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": "",
            "prompt": "I'm sure _____ find a great job soon.",
            "options": [
              "I'll",
              "Shall I",
              "Shall we"
            ]
          }
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Use the verbs in the box and will or won’t to complete these sentences. Use short forms of will when you can.",
        "questions": [
          {
            "id": "q1",
            "before": "Peter needs to study more or he ",
            "after": " the exam.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "A: Shall we watch a film? B: Good idea! I ",
            "after": " the TV.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "A: ",
            "after": " you … at your office tomorrow morning? B: Yes, I'll be there all morning.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "A: … you ",
            "after": " at your office tomorrow morning? B: Yes, I'll be there all morning.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "I'm not sure Sandra ",
            "after": " the job. They interviewed a lot of people for the same job.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "He ",
            "after": " the election. Very few people will vote for him and he'll lose.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "A: When ",
            "after": " I … you again? B: I don't know. I hope you'll see me very soon.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "A: When … I ",
            "after": " you again? B: I don't know. I hope you'll see me very soon.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "I don't think he ",
            "after": " to the party. He doesn't like big parties.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "I'm sorry but I ",
            "after": " you the money. I have no money.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q11",
            "before": "Do you think they ",
            "after": " the match?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q12",
            "before": "Perhaps I ",
            "after": " at home tonight. I want to relax and watch a movie.",
            "options": [],
            "kind": "text"
          }
        ],
        "context": "be (x2) – come – get – lend – pass – see – stay – turn on – win (x2) EXAMPLE: I won’t be at the office on time. There’s a lot of traffic.",
        "passage": [
          [
            {
              "text": "Peter needs to study more or he "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " the exam."
            }
          ],
          [
            {
              "text": "A: Shall we watch a film? B: Good idea! I "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " the TV."
            }
          ],
          [
            {
              "text": "A: "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " you "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " at your office tomorrow morning? B: Yes, I'll be there all morning."
            }
          ],
          [
            {
              "text": "I'm not sure Sandra "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " the job. They interviewed a lot of people for the same job."
            }
          ],
          [
            {
              "text": "He "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " the election. Very few people will vote for him and he'll lose."
            }
          ],
          [
            {
              "text": "A: When "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " I "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " you again? B: I don't know. I hope you'll see me very soon."
            }
          ],
          [
            {
              "text": "I don't think he "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " to the party. He doesn't like big parties."
            }
          ],
          [
            {
              "text": "I'm sorry but I "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " you the money. I have no money."
            }
          ],
          [
            {
              "text": "Do you think they "
            },
            {
              "questionId": "q11"
            },
            {
              "text": " the match?"
            }
          ],
          [
            {
              "text": "Perhaps I "
            },
            {
              "questionId": "q12"
            },
            {
              "text": " at home tonight. I want to relax and watch a movie."
            }
          ]
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Complete the sentences with ‘ll (will), won’t or shall and the words in brackets. Use short forms of will when you can",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": " back soon? (she/be)",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "A: Will he leave? B: No, he ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "",
            "after": " the bag for you? It looks heavy. (I/carry)",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "They ",
            "after": " the tournament. It's impossible. (win)",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "",
            "after": " me a favour? (you/do)",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "A: ",
            "after": " tomorrow again? B: Yes, great! (we/meet)",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "I don't think the readers ",
            "after": " his new book. (like)",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "It's dark. I ",
            "after": " the light. (turn on)",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "I'm sure he ",
            "after": " us. He always helps people. (help)",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "A: ",
            "after": " for dinner tonight? B: OK. (we/go out)",
            "options": [],
            "kind": "text"
          }
        ],
        "context": "EXAMPLE: Sentence ⇒ Will she passthe exam? (she/pass)",
        "passage": [
          [
            {
              "questionId": "q1"
            },
            {
              "text": " back soon? (she/be)"
            }
          ],
          [
            {
              "text": "A: Will he leave? B: No, he "
            },
            {
              "questionId": "q2"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "questionId": "q3"
            },
            {
              "text": " the bag for you? It looks heavy. (I/carry)"
            }
          ],
          [
            {
              "text": "They "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " the tournament. It's impossible. (win)"
            }
          ],
          [
            {
              "questionId": "q5"
            },
            {
              "text": " me a favour? (you/do)"
            }
          ],
          [
            {
              "text": "A: "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " tomorrow again? B: Yes, great! (we/meet)"
            }
          ],
          [
            {
              "text": "I don't think the readers "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " his new book. (like)"
            }
          ],
          [
            {
              "text": "It's dark. I "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " the light. (turn on)"
            }
          ],
          [
            {
              "text": "I'm sure he "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " us. He always helps people. (help)"
            }
          ],
          [
            {
              "text": "A: "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " for dinner tonight? B: OK. (we/go out)"
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-be-going-to-plans-predictions",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "Be going to: Plans and predictions",
    "subtitle": "A1 grammar · all exercises",
    "cover": {
      "src": "/images/tests/a1-be-going-to-plans-predictions-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: Be going to: Plans and predictions"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Use the verbs in brackets to complete these sentences with be going to affirmative or negative.",
        "questions": [
          {
            "id": "q1",
            "before": "I ",
            "after": " (borrow) some books from the library today.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "He ",
            "after": " (not pay) your money back.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "The drone is out of control. It ",
            "after": " (crash)!",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "They aren't playing well. They ",
            "after": " (not win) the match.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "We ",
            "after": " (have) a picnic tomorrow.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "She ",
            "after": " (fly) to New York next week.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "You can take the newspaper. I ",
            "after": " (not read) it.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "I need to tell you something, but you ",
            "after": " (not believe) me.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "Look at the sun! It ",
            "after": " (be) a beautiful day.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "I ",
            "after": " (not argue) with you.",
            "options": [],
            "kind": "text"
          }
        ],
        "passage": [
          [
            {
              "text": "I "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " (borrow) some books from the library today."
            }
          ],
          [
            {
              "text": "He "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " (not pay) your money back."
            }
          ],
          [
            {
              "text": "The drone is out of control. It "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " (crash)!"
            }
          ],
          [
            {
              "text": "They aren't playing well. They "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " (not win) the match."
            }
          ],
          [
            {
              "text": "We "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " (have) a picnic tomorrow."
            }
          ],
          [
            {
              "text": "She "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " (fly) to New York next week."
            }
          ],
          [
            {
              "text": "You can take the newspaper. I "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " (not read) it."
            }
          ],
          [
            {
              "text": "I need to tell you something, but you "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " (not believe) me."
            }
          ],
          [
            {
              "text": "Look at the sun! It "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " (be) a beautiful day."
            }
          ],
          [
            {
              "text": "I "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " (not argue) with you."
            }
          ]
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Use the words in brackes to write questions using be going to.",
        "questions": [
          {
            "id": "q1",
            "before": "Which dress ",
            "after": " (she/wear) for the party?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "What ",
            "after": " (you/do) after you graduate from university?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "What time ",
            "after": " (they/pick) you up at the airport?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "How ",
            "after": " (we/survive) here? There's no food.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "Where ",
            "after": " (he/stay) tonight?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "I'm hungry. ",
            "after": " (you/eat) that pie?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "Doctor, ",
            "after": " (it/hurt)?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "What ",
            "after": " (you/watch) on Netflix today?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "What ",
            "after": " (he/say) at the press conference today?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "How ",
            "after": " (they/solve) this problem?",
            "options": [],
            "kind": "text"
          }
        ],
        "passage": [
          [
            {
              "text": "Which dress "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " (she/wear) for the party?"
            }
          ],
          [
            {
              "text": "What "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " (you/do) after you graduate from university?"
            }
          ],
          [
            {
              "text": "What time "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " (they/pick) you up at the airport?"
            }
          ],
          [
            {
              "text": "How "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " (we/survive) here? There's no food."
            }
          ],
          [
            {
              "text": "Where "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " (he/stay) tonight?"
            }
          ],
          [
            {
              "text": "I'm hungry. "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " (you/eat) that pie?"
            }
          ],
          [
            {
              "text": "Doctor, "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " (it/hurt)?"
            }
          ],
          [
            {
              "text": "What "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " (you/watch) on Netflix today?"
            }
          ],
          [
            {
              "text": "What "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " (he/say) at the press conference today?"
            }
          ],
          [
            {
              "text": "How "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " (they/solve) this problem?"
            }
          ]
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Complete this email with the affirmative, negative or interrogative forms of be going to. Use the words in brackets.",
        "questions": [
          {
            "id": "q1",
            "before": "How are you?  ",
            "after": " (you/visit) us this summer? In July we  … (have) a big party. It  … (be) really fun. I want to have some great music, so I  … (find) a good DJ. My parents  … (pay) for the food and drinks.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "How are you?  … (you/visit) us this summer? In July we  ",
            "after": " (have) a big party. It  … (be) really fun. I want to have some great music, so I  … (find) a good DJ. My parents  … (pay) for the food and drinks.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "How are you?  … (you/visit) us this summer? In July we  … (have) a big party. It  ",
            "after": " (be) really fun. I want to have some great music, so I  … (find) a good DJ. My parents  … (pay) for the food and drinks.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "How are you?  … (you/visit) us this summer? In July we  … (have) a big party. It  … (be) really fun. I want to have some great music, so I  ",
            "after": " (find) a good DJ. My parents  … (pay) for the food and drinks.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "How are you?  … (you/visit) us this summer? In July we  … (have) a big party. It  … (be) really fun. I want to have some great music, so I  … (find) a good DJ. My parents  ",
            "after": " (pay) for the food and drinks.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "My sister  ",
            "after": " (not be) there because she  … (travel) to Canada with a friend. Sorry! They  … (fly) to Montreal and then they  … (go) to Vancouver by train. They  … (not come) back until August.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "My sister  … (not be) there because she  ",
            "after": " (travel) to Canada with a friend. Sorry! They  … (fly) to Montreal and then they  … (go) to Vancouver by train. They  … (not come) back until August.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "My sister  … (not be) there because she  … (travel) to Canada with a friend. Sorry! They  ",
            "after": " (fly) to Montreal and then they  … (go) to Vancouver by train. They  … (not come) back until August.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "My sister  … (not be) there because she  … (travel) to Canada with a friend. Sorry! They  … (fly) to Montreal and then they  ",
            "after": " (go) to Vancouver by train. They  … (not come) back until August.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "My sister  … (not be) there because she  … (travel) to Canada with a friend. Sorry! They  … (fly) to Montreal and then they  … (go) to Vancouver by train. They  ",
            "after": " (not come) back until August.",
            "options": [],
            "kind": "text"
          }
        ],
        "passage": [
          [
            {
              "text": "Hi Tim,"
            }
          ],
          [
            {
              "text": "How are you?  "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " (you/visit) us this summer? In July we  "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " (have) a big party. It  "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " (be) really fun. I want to have some great music, so I  "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " (find) a good DJ. My parents  "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " (pay) for the food and drinks."
            }
          ],
          [
            {
              "text": "My sister  "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " (not be) there because she  "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " (travel) to Canada with a friend. Sorry! They  "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " (fly) to Montreal and then they  "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " (go) to Vancouver by train. They  "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " (not come) back until August."
            }
          ],
          [
            {
              "text": "Hope you can come to the party!"
            }
          ],
          [
            {
              "text": "Ben"
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-adverbs-manner",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "Adverbs of manner (slowly) or adjectives (slow)?",
    "subtitle": "A1 grammar · all exercises",
    "cover": {
      "src": "/images/tests/a1-adverbs-manner-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: Adverbs of manner (slowly) or adjectives (slow)?"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Choose adjectives or adverbs of manner to complete the following sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "Peter is a ",
            "after": " driver. He drives very ….",
            "options": [
              "carefully",
              "careful"
            ]
          },
          {
            "id": "q2",
            "before": "Peter is a … driver. He drives very ",
            "after": ".",
            "options": [
              "careful",
              "carefully"
            ]
          },
          {
            "id": "q3",
            "before": "Turtles walk ",
            "after": " because they are … animals.",
            "options": [
              "slowly",
              "slow"
            ]
          },
          {
            "id": "q4",
            "before": "Turtles walk … because they are ",
            "after": " animals.",
            "options": [
              "slowly",
              "slow"
            ]
          },
          {
            "id": "q5",
            "before": "A ",
            "after": " person usually speaks ….",
            "options": [
              "cautious",
              "cautiously"
            ]
          },
          {
            "id": "q6",
            "before": "A … person usually speaks ",
            "after": ".",
            "options": [
              "cautious",
              "cautiously"
            ]
          },
          {
            "id": "q7",
            "before": "They are ",
            "after": "; they are speaking ….",
            "options": [
              "quiet",
              "quietly"
            ]
          },
          {
            "id": "q8",
            "before": "They are …; they are speaking ",
            "after": ".",
            "options": [
              "quiet",
              "quietly"
            ]
          },
          {
            "id": "q9",
            "before": "Gordon plays very ",
            "after": ". He is a … player.",
            "options": [
              "good",
              "well"
            ]
          },
          {
            "id": "q10",
            "before": "Gordon plays very …. He is a ",
            "after": " player.",
            "options": [
              "good",
              "well"
            ]
          },
          {
            "id": "q11",
            "before": "He did a ",
            "after": " exam. He passed the exam ….",
            "options": [
              "brilliantly",
              "brilliant"
            ]
          },
          {
            "id": "q12",
            "before": "He did a … exam. He passed the exam ",
            "after": ".",
            "options": [
              "brilliantly",
              "brilliant"
            ]
          },
          {
            "id": "q13",
            "before": "We had ",
            "after": " snow yesterday. It snowed ….",
            "options": [
              "heavy",
              "heavily"
            ]
          },
          {
            "id": "q14",
            "before": "We had … snow yesterday. It snowed ",
            "after": ".",
            "options": [
              "heavily",
              "heavy"
            ]
          },
          {
            "id": "q15",
            "before": "He looked at me ",
            "after": ". He has a very … look.",
            "options": [
              "angry",
              "angrily"
            ]
          },
          {
            "id": "q16",
            "before": "He looked at me …. He has a very ",
            "after": " look.",
            "options": [
              "angry",
              "angrily"
            ]
          },
          {
            "id": "q17",
            "before": "We slept ",
            "after": " in our … bed.",
            "options": [
              "comfortable",
              "comfortably"
            ]
          },
          {
            "id": "q18",
            "before": "We slept … in our ",
            "after": " bed.",
            "options": [
              "comfortable",
              "comfortably"
            ]
          },
          {
            "id": "q19",
            "before": "He plays ",
            "after": " because he is a … player.",
            "options": [
              "bad",
              "badly"
            ]
          },
          {
            "id": "q20",
            "before": "He plays … because he is a ",
            "after": " player.",
            "options": [
              "badly",
              "bad"
            ]
          }
        ],
        "passage": [
          [
            {
              "text": "Peter is a "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " driver. He drives very "
            },
            {
              "questionId": "q2"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "Turtles walk "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " because they are "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " animals."
            }
          ],
          [
            {
              "text": "A "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " person usually speaks "
            },
            {
              "questionId": "q6"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "They are "
            },
            {
              "questionId": "q7"
            },
            {
              "text": "; they are speaking "
            },
            {
              "questionId": "q8"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "Gordon plays very "
            },
            {
              "questionId": "q9"
            },
            {
              "text": ". He is a "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " player."
            }
          ],
          [
            {
              "text": "He did a "
            },
            {
              "questionId": "q11"
            },
            {
              "text": " exam. He passed the exam "
            },
            {
              "questionId": "q12"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "We had "
            },
            {
              "questionId": "q13"
            },
            {
              "text": " snow yesterday. It snowed "
            },
            {
              "questionId": "q14"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "He looked at me "
            },
            {
              "questionId": "q15"
            },
            {
              "text": ". He has a very "
            },
            {
              "questionId": "q16"
            },
            {
              "text": " look."
            }
          ],
          [
            {
              "text": "We slept "
            },
            {
              "questionId": "q17"
            },
            {
              "text": " in our "
            },
            {
              "questionId": "q18"
            },
            {
              "text": " bed."
            }
          ],
          [
            {
              "text": "He plays "
            },
            {
              "questionId": "q19"
            },
            {
              "text": " because he is a "
            },
            {
              "questionId": "q20"
            },
            {
              "text": " player."
            }
          ]
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Complete the following sentences with the correct adjectives or adverbs of manner.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": "",
            "prompt": "He normally drives very _____.",
            "options": [
              "slow",
              "fastly",
              "fast"
            ]
          },
          {
            "id": "q2",
            "before": "",
            "after": "",
            "prompt": "I passed _____.",
            "options": [
              "easily the test",
              "the test easily",
              "easy the test"
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": "",
            "prompt": "The people in this company work very _____.",
            "options": [
              "hard",
              "hardly",
              "good"
            ]
          },
          {
            "id": "q4",
            "before": "",
            "after": "",
            "prompt": "She is a _____ teacher.",
            "options": [
              "well",
              "good",
              "goodly"
            ]
          },
          {
            "id": "q5",
            "before": "",
            "after": "",
            "prompt": "She teaches English very _____.",
            "options": [
              "good",
              "goodly",
              "well"
            ]
          },
          {
            "id": "q6",
            "before": "",
            "after": "",
            "prompt": "You answered _____.",
            "options": [
              "correctly the question",
              "the question correctly",
              "the question correct"
            ]
          },
          {
            "id": "q7",
            "before": "",
            "after": "",
            "prompt": "The article describes the situation very _____.",
            "options": [
              "simple",
              "simplely",
              "simply"
            ]
          },
          {
            "id": "q8",
            "before": "",
            "after": "",
            "prompt": "They live _____ in Munich.",
            "options": [
              "happy",
              "happyly",
              "happily"
            ]
          },
          {
            "id": "q9",
            "before": "",
            "after": "",
            "prompt": "After the break, we _____.",
            "options": [
              "finished the job easily",
              "easily finished the job",
              "finished the job easy"
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": "",
            "prompt": "He didn't speak _____ English.",
            "options": [
              "clearly",
              "clear",
              "well"
            ]
          }
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Complete the sentences using adjectives or adverbs. Use the adjectives in the list and the adverbs formed from those adjectives.",
        "questions": [
          {
            "id": "q1",
            "before": "Please, can you speak ",
            "after": "? I don't understand you.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "He won the race. He ran very ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "Your answer is ",
            "after": ". Can you answer it again?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "We were one hour late, but he waited ",
            "after": " until we arrived.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "It was an ",
            "after": " question. I answered it without thinking.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "You answered the question ",
            "after": ". Can you answer it again?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "Please, be ",
            "after": " with him. He's young and inexperienced.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "He's a really ",
            "after": " runner. He wins a lot of races.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "The water isn't ",
            "after": "; it's dirty.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "We climbed the mountain ",
            "after": ". We weren't tired after doing it.",
            "options": [],
            "kind": "text"
          }
        ],
        "context": "clear – easy – fast – incorrect – patient – quick EXAMPLE: I need a quick answer. EXAMPLE: He answered my question very quickly",
        "passage": [
          [
            {
              "text": "Please, can you speak "
            },
            {
              "questionId": "q1"
            },
            {
              "text": "? I don't understand you."
            }
          ],
          [
            {
              "text": "He won the race. He ran very "
            },
            {
              "questionId": "q2"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "Your answer is "
            },
            {
              "questionId": "q3"
            },
            {
              "text": ". Can you answer it again?"
            }
          ],
          [
            {
              "text": "We were one hour late, but he waited "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " until we arrived."
            }
          ],
          [
            {
              "text": "It was an "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " question. I answered it without thinking."
            }
          ],
          [
            {
              "text": "You answered the question "
            },
            {
              "questionId": "q6"
            },
            {
              "text": ". Can you answer it again?"
            }
          ],
          [
            {
              "text": "Please, be "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " with him. He's young and inexperienced."
            }
          ],
          [
            {
              "text": "He's a really "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " runner. He wins a lot of races."
            }
          ],
          [
            {
              "text": "The water isn't "
            },
            {
              "questionId": "q9"
            },
            {
              "text": "; it's dirty."
            }
          ],
          [
            {
              "text": "We climbed the mountain "
            },
            {
              "questionId": "q10"
            },
            {
              "text": ". We weren't tired after doing it."
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-a-an-the-no-article",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "A/an, the, no article: The use of articles in English",
    "subtitle": "A1 grammar · all exercises",
    "cover": {
      "src": "/images/tests/a1-a-an-the-no-article-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: A/an, the, no article: The use of articles in English"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Choose a/an, the or no article to complete the following sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "We bought some cheese and ham. ",
            "after": " cheese was delicious.",
            "options": [
              "The",
              "-",
              "A"
            ]
          },
          {
            "id": "q2",
            "before": "It's ",
            "after": " interesting book.",
            "options": [
              "an",
              "-",
              "the"
            ]
          },
          {
            "id": "q3",
            "before": "There was ",
            "after": " document on the table.",
            "options": [
              "-",
              "a",
              "the"
            ]
          },
          {
            "id": "q4",
            "before": "Experts say that ",
            "after": " coffee can be good for your health.",
            "options": [
              "the",
              "-",
              "a"
            ]
          },
          {
            "id": "q5",
            "before": "I don't have ",
            "after": " car.",
            "options": [
              "-",
              "the",
              "a"
            ]
          },
          {
            "id": "q6",
            "before": "Can you pass me ",
            "after": " water?",
            "options": [
              "a",
              "the",
              "-"
            ]
          },
          {
            "id": "q7",
            "before": "",
            "after": " president visited our school.",
            "options": [
              "A",
              "-",
              "The"
            ]
          },
          {
            "id": "q8",
            "before": "My father is ",
            "after": " police officer.",
            "options": [
              "a",
              "-",
              "the"
            ]
          },
          {
            "id": "q9",
            "before": "Everybody knows that ",
            "after": " cats are very independent animals.",
            "options": [
              "the",
              "a",
              "-"
            ]
          },
          {
            "id": "q10",
            "before": "She picked me up at ",
            "after": " airport.",
            "options": [
              "an",
              "the",
              "-"
            ]
          }
        ],
        "passage": [
          [
            {
              "text": "We bought some cheese and ham. "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " cheese was delicious."
            }
          ],
          [
            {
              "text": "It's "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " interesting book."
            }
          ],
          [
            {
              "text": "There was "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " document on the table."
            }
          ],
          [
            {
              "text": "Experts say that "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " coffee can be good for your health."
            }
          ],
          [
            {
              "text": "I don't have "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " car."
            }
          ],
          [
            {
              "text": "Can you pass me "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " water?"
            }
          ],
          [
            {
              "questionId": "q7"
            },
            {
              "text": " president visited our school."
            }
          ],
          [
            {
              "text": "My father is "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " police officer."
            }
          ],
          [
            {
              "text": "Everybody knows that "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " cats are very independent animals."
            }
          ],
          [
            {
              "text": "She picked me up at "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " airport."
            }
          ]
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Choose a/an, the or no article to complete the sentences below.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": "",
            "prompt": "'Where is Jennifer?' 'She's in _____ kitchen.'",
            "options": [
              "a",
              "the",
              "–"
            ]
          },
          {
            "id": "q2",
            "before": "",
            "after": "",
            "prompt": "Do you want to have _____ lunch with me?",
            "options": [
              "a",
              "the",
              "–"
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": "",
            "prompt": "What are you going to do _____ next Saturday?",
            "options": [
              "a",
              "the",
              "–"
            ]
          },
          {
            "id": "q4",
            "before": "",
            "after": "",
            "prompt": "I want to learn how to play _____ piano.",
            "options": [
              "a",
              "the",
              "–"
            ]
          },
          {
            "id": "q5",
            "before": "",
            "after": "",
            "prompt": "We want to buy _____ new car.",
            "options": [
              "a",
              "the",
              "–"
            ]
          },
          {
            "id": "q6",
            "before": "",
            "after": "",
            "prompt": "My favourite subject is _____ history.",
            "options": [
              "a",
              "the",
              "–"
            ]
          },
          {
            "id": "q7",
            "before": "",
            "after": "",
            "prompt": "_____ students in my class are great.",
            "options": [
              "A",
              "The",
              "–"
            ]
          },
          {
            "id": "q8",
            "before": "",
            "after": "",
            "prompt": "Medicine will be completely different in _____ 2050.",
            "options": [
              "the",
              "a",
              "–"
            ]
          },
          {
            "id": "q9",
            "before": "",
            "after": "",
            "prompt": "He is very interested in _____ computers.",
            "options": [
              "a",
              "the",
              "–"
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": "",
            "prompt": "A thief got into our office and stole _____ computers.",
            "options": [
              "a",
              "the",
              "–"
            ]
          }
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Complete the following sentences with a/an, the or no article.",
        "questions": [
          {
            "id": "q1",
            "before": "We went to ",
            "after": " nice restaurant yesterday.",
            "options": [
              "a",
              "-",
              "the"
            ]
          },
          {
            "id": "q2",
            "before": "Can you bring me some ham from ",
            "after": " fridge?",
            "options": [
              "the",
              "a",
              "-"
            ]
          },
          {
            "id": "q3",
            "before": "You never eat ",
            "after": " fish.",
            "options": [
              "a",
              "the",
              "-"
            ]
          },
          {
            "id": "q4",
            "before": "She cooked a very nice meal yesterday. ",
            "after": " fish was delicious.",
            "options": [
              "–",
              "The",
              "A"
            ]
          },
          {
            "id": "q5",
            "before": "Nowadays, ",
            "after": " children spend a lot of time using technology.",
            "options": [
              "-",
              "the",
              "a"
            ]
          },
          {
            "id": "q6",
            "before": "I'm going to buy ",
            "after": " new computer because … computer in my office is broken.",
            "options": [
              "the",
              "-",
              "a"
            ]
          },
          {
            "id": "q7",
            "before": "I'm going to buy … new computer because ",
            "after": " computer in my office is broken.",
            "options": [
              "the",
              "a",
              "-"
            ]
          },
          {
            "id": "q8",
            "before": "I don't like ",
            "after": " police officers, but … police officers in this town are nice.",
            "options": [
              "-",
              "the",
              "a"
            ]
          },
          {
            "id": "q9",
            "before": "I don't like … police officers, but ",
            "after": " police officers in this town are nice.",
            "options": [
              "a",
              "-",
              "the"
            ]
          },
          {
            "id": "q10",
            "before": "Laura has ",
            "after": " dog and some cats. … dog is really cute.",
            "options": [
              "a",
              "the",
              "-"
            ]
          },
          {
            "id": "q11",
            "before": "Laura has … dog and some cats. ",
            "after": " dog is really cute.",
            "options": [
              "The",
              "A",
              "-"
            ]
          },
          {
            "id": "q12",
            "before": "My father is ",
            "after": " pianist. He is … great musician.",
            "options": [
              "-",
              "the",
              "a"
            ]
          },
          {
            "id": "q13",
            "before": "My father is … pianist. He is ",
            "after": " great musician.",
            "options": [
              "the",
              "a",
              "-"
            ]
          },
          {
            "id": "q14",
            "before": "I don't like ",
            "after": " chicken, but I like … chicken that my mother cooks.",
            "options": [
              "a",
              "the",
              "-"
            ]
          },
          {
            "id": "q15",
            "before": "I don't like … chicken, but I like ",
            "after": " chicken that my mother cooks.",
            "options": [
              "the",
              "-",
              "a"
            ]
          }
        ],
        "passage": [
          [
            {
              "text": "We went to "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " nice restaurant yesterday."
            }
          ],
          [
            {
              "text": "Can you bring me some ham from "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " fridge?"
            }
          ],
          [
            {
              "text": "You never eat "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " fish."
            }
          ],
          [
            {
              "text": "She cooked a very nice meal yesterday. "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " fish was delicious."
            }
          ],
          [
            {
              "text": "Nowadays, "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " children spend a lot of time using technology."
            }
          ],
          [
            {
              "text": "I'm going to buy "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " new computer because "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " computer in my office is broken."
            }
          ],
          [
            {
              "text": "I don't like "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " police officers, but "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " police officers in this town are nice."
            }
          ],
          [
            {
              "text": "Laura has "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " dog and some cats. "
            },
            {
              "questionId": "q11"
            },
            {
              "text": " dog is really cute."
            }
          ],
          [
            {
              "text": "My father is "
            },
            {
              "questionId": "q12"
            },
            {
              "text": " pianist. He is "
            },
            {
              "questionId": "q13"
            },
            {
              "text": " great musician."
            }
          ],
          [
            {
              "text": "I don't like "
            },
            {
              "questionId": "q14"
            },
            {
              "text": " chicken, but I like "
            },
            {
              "questionId": "q15"
            },
            {
              "text": " chicken that my mother cooks."
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-conjunctions_and-but-or-so-because",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "Conjunctions: And, but, or, so, because",
    "subtitle": "A1 grammar · all exercises",
    "cover": {
      "src": "/images/tests/a1-conjunctions_and-but-or-so-because-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: Conjunctions: And, but, or, so, because"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Choose and, but, or, so, because to complete each sentence.",
        "questions": [
          {
            "id": "q1",
            "before": "I called Tom, ",
            "after": " he didn't answer.",
            "options": [
              "so",
              "but",
              "or",
              "because"
            ]
          },
          {
            "id": "q2",
            "before": "I'm tired ",
            "after": " I went to bed very late.",
            "options": [
              "because",
              "so",
              "and",
              "but"
            ]
          },
          {
            "id": "q3",
            "before": "It was very late, ",
            "after": " we took a taxi.",
            "options": [
              "so",
              "but",
              "because",
              "or"
            ]
          },
          {
            "id": "q4",
            "before": "You can go by bus ",
            "after": " by train.",
            "options": [
              "so",
              "but",
              "because",
              "or"
            ]
          },
          {
            "id": "q5",
            "before": "She got into the car ",
            "after": " left.",
            "options": [
              "so",
              "but",
              "or",
              "and"
            ]
          },
          {
            "id": "q6",
            "before": "I called you ",
            "after": " I was worried.",
            "options": [
              "and",
              "so",
              "because",
              "but"
            ]
          },
          {
            "id": "q7",
            "before": "Would you like to do it now ",
            "after": " later?",
            "options": [
              "and",
              "so",
              "but",
              "or"
            ]
          },
          {
            "id": "q8",
            "before": "She can sing, ",
            "after": " she can't dance.",
            "options": [
              "or",
              "but",
              "so",
              "and"
            ]
          },
          {
            "id": "q9",
            "before": "I wasn't hungry, ",
            "after": " I didn't eat.",
            "options": [
              "or",
              "but",
              "so",
              "because"
            ]
          },
          {
            "id": "q10",
            "before": "I have one brother ",
            "after": " two sisters.",
            "options": [
              "but",
              "and",
              "so",
              "or"
            ]
          }
        ],
        "passage": [
          [
            {
              "text": "I called Tom, "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " he didn't answer."
            }
          ],
          [
            {
              "text": "I'm tired "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " I went to bed very late."
            }
          ],
          [
            {
              "text": "It was very late, "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " we took a taxi."
            }
          ],
          [
            {
              "text": "You can go by bus "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " by train."
            }
          ],
          [
            {
              "text": "She got into the car "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " left."
            }
          ],
          [
            {
              "text": "I called you "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " I was worried."
            }
          ],
          [
            {
              "text": "Would you like to do it now "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " later?"
            }
          ],
          [
            {
              "text": "She can sing, "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " she can't dance."
            }
          ],
          [
            {
              "text": "I wasn't hungry, "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " I didn't eat."
            }
          ],
          [
            {
              "text": "I have one brother "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " two sisters."
            }
          ]
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Choose and, but, or, so, because to complete these sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": "",
            "prompt": "I don't have any brothers _____ sisters. I'm an only child.",
            "options": [
              "or",
              "and",
              "but",
              "because"
            ]
          },
          {
            "id": "q2",
            "before": "",
            "after": "",
            "prompt": "I get home at around 7 p.m., _____ then I make dinner.",
            "options": [
              "but",
              "and",
              "or",
              "because"
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": "",
            "prompt": "It's raining, _____ we should take our umbrellas.",
            "options": [
              "and",
              "but",
              "because",
              "so"
            ]
          },
          {
            "id": "q4",
            "before": "",
            "after": "",
            "prompt": "She went home _____ she wasn't feeling very well.",
            "options": [
              "because",
              "and",
              "but",
              "so"
            ]
          },
          {
            "id": "q5",
            "before": "",
            "after": "",
            "prompt": "We had a little accident, _____ everybody is OK.",
            "options": [
              "and",
              "but",
              "or",
              "so"
            ]
          },
          {
            "id": "q6",
            "before": "",
            "after": "",
            "prompt": "I bought a pair of shoes in the sales, _____ my wife bought a new dress.",
            "options": [
              "because",
              "or",
              "and",
              "but"
            ]
          },
          {
            "id": "q7",
            "before": "",
            "after": "",
            "prompt": "It was a fantastic opportunity, _____ I decided to take it.",
            "options": [
              "because",
              "or",
              "so",
              "and"
            ]
          },
          {
            "id": "q8",
            "before": "",
            "after": "",
            "prompt": "I didn't tell you the truth _____ I didn't want to hurt your feelings.",
            "options": [
              "so",
              "because",
              "and",
              "but"
            ]
          },
          {
            "id": "q9",
            "before": "",
            "after": "",
            "prompt": "I hated the present, _____ I said it was great.",
            "options": [
              "so",
              "or",
              "because",
              "but"
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": "",
            "prompt": "We can do it now _____ after lunch.",
            "options": [
              "or",
              "but",
              "and",
              "because"
            ]
          }
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Fill in each gap using one of these conjunctions: and, but, or, so, because.",
        "questions": [
          {
            "id": "q1",
            "before": "I have a car, ",
            "after": " I never drive to work … the tube is faster.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "I have a car, … I never drive to work ",
            "after": " the tube is faster.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "We couldn't do any shopping ",
            "after": " it was a holiday.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "Junk food is delicious ",
            "after": " very unhealthy, … you should not eat it very often.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "Junk food is delicious … very unhealthy, ",
            "after": " you should not eat it very often.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "I knew Sara could help me, ",
            "after": " I asked her for help.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "Would you like to watch a film at home ",
            "after": " to go to the movies?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "I wasn't feeling well, ",
            "after": " I went to the doctor, … he told me that I need to start a diet.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "I wasn't feeling well, … I went to the doctor, ",
            "after": " he told me that I need to start a diet.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "I'm from the UK, ",
            "after": " I live in the US … my wife is American.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q11",
            "before": "I'm from the UK, … I live in the US ",
            "after": " my wife is American.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q12",
            "before": "He's a great person, ",
            "after": " he's totally crazy.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q13",
            "before": "My brother is easy-going ",
            "after": " positive, … my sister is very pessimistic.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q14",
            "before": "My brother is easy-going … positive, ",
            "after": " my sister is very pessimistic.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q15",
            "before": "The city is expensive. You should rent a room in a shared flat ",
            "after": " a small studio.",
            "options": [],
            "kind": "text"
          }
        ],
        "passage": [
          [
            {
              "text": "I have a car, "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " I never drive to work "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " the tube is faster."
            }
          ],
          [
            {
              "text": "We couldn't do any shopping "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " it was a holiday."
            }
          ],
          [
            {
              "text": "Junk food is delicious "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " very unhealthy, "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " you should not eat it very often."
            }
          ],
          [
            {
              "text": "I knew Sara could help me, "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " I asked her for help."
            }
          ],
          [
            {
              "text": "Would you like to watch a film at home "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " to go to the movies?"
            }
          ],
          [
            {
              "text": "I wasn't feeling well, "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " I went to the doctor, "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " he told me that I need to start a diet."
            }
          ],
          [
            {
              "text": "I'm from the UK, "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " I live in the US "
            },
            {
              "questionId": "q11"
            },
            {
              "text": " my wife is American."
            }
          ],
          [
            {
              "text": "He's a great person, "
            },
            {
              "questionId": "q12"
            },
            {
              "text": " he's totally crazy."
            }
          ],
          [
            {
              "text": "My brother is easy-going "
            },
            {
              "questionId": "q13"
            },
            {
              "text": " positive, "
            },
            {
              "questionId": "q14"
            },
            {
              "text": " my sister is very pessimistic."
            }
          ],
          [
            {
              "text": "The city is expensive. You should rent a room in a shared flat "
            },
            {
              "questionId": "q15"
            },
            {
              "text": " a small studio."
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-basic-word-order-in-english",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "Basic word order in English",
    "subtitle": "A1 grammar · all exercises",
    "cover": {
      "src": "/images/tests/a1-basic-word-order-in-english-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: Basic word order in English"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Fill in the gaps with the correct options.",
        "questions": [
          {
            "id": "q1",
            "before": "I didn't like ",
            "after": " last night.",
            "options": [
              "the food very much",
              "very much the food"
            ]
          },
          {
            "id": "q2",
            "before": "We arrived ",
            "after": ".",
            "options": [
              "home very late",
              "very late home"
            ]
          },
          {
            "id": "q3",
            "before": "Teresa speaks ",
            "after": ".",
            "options": [
              "very well English",
              "English very well"
            ]
          },
          {
            "id": "q4",
            "before": "Please, can you put ",
            "after": "?",
            "options": [
              "in the corner that box",
              "that box in the corner"
            ]
          },
          {
            "id": "q5",
            "before": "After the accident, Jim was ",
            "after": ".",
            "options": [
              "for a week in hospital",
              "in hospital for a week"
            ]
          },
          {
            "id": "q6",
            "before": "I like ",
            "after": ".",
            "options": [
              "a lot this music",
              "this music a lot"
            ]
          },
          {
            "id": "q7",
            "before": "They met ",
            "after": ".",
            "options": [
              "after a party at a friend's house",
              "at a friend's house after a party"
            ]
          },
          {
            "id": "q8",
            "before": "Tigers approach ",
            "after": ".",
            "options": [
              "their victims very slowly",
              "very slowly their victims"
            ]
          },
          {
            "id": "q9",
            "before": "I saw ",
            "after": ".",
            "options": [
              "Hellen at the library",
              "at the library Hellen"
            ]
          },
          {
            "id": "q10",
            "before": "He finished ",
            "after": ".",
            "options": [
              "the exam very quickly",
              "very quickly the exam"
            ]
          }
        ],
        "passage": [
          [
            {
              "text": "I didn't like "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " last night."
            }
          ],
          [
            {
              "text": "We arrived "
            },
            {
              "questionId": "q2"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "Teresa speaks "
            },
            {
              "questionId": "q3"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "Please, can you put "
            },
            {
              "questionId": "q4"
            },
            {
              "text": "?"
            }
          ],
          [
            {
              "text": "After the accident, Jim was "
            },
            {
              "questionId": "q5"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "I like "
            },
            {
              "questionId": "q6"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "They met "
            },
            {
              "questionId": "q7"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "Tigers approach "
            },
            {
              "questionId": "q8"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "I saw "
            },
            {
              "questionId": "q9"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "He finished "
            },
            {
              "questionId": "q10"
            },
            {
              "text": "."
            }
          ]
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Choose the correct options to complete the sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": "",
            "prompt": "I walk _____.",
            "options": [
              "my dog in the park every day",
              "my dog every day in the park",
              "every day my dog in the park"
            ]
          },
          {
            "id": "q2",
            "before": "",
            "after": "",
            "prompt": "Lisa took _____.",
            "options": [
              "her son to the doctor this morning",
              "to the doctor her son this morning",
              "this morning her son to the doctor"
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": "",
            "prompt": "Can you drive _____?",
            "options": [
              "home me after the concert",
              "me after the concert home",
              "me home after the concert"
            ]
          },
          {
            "id": "q4",
            "before": "",
            "after": "",
            "prompt": "We ______.",
            "options": [
              "enjoyed very much the trip",
              "enjoyed the trip very much",
              "very much enjoyed the trip"
            ]
          },
          {
            "id": "q5",
            "before": "",
            "after": "",
            "prompt": "I _____.",
            "options": [
              "bought in Paris this jacket last year",
              "bought this jacket last year in Paris",
              "bought this jacket in Paris last year"
            ]
          },
          {
            "id": "q6",
            "before": "",
            "after": "",
            "prompt": "I ______.",
            "options": [
              "will call my parents immediately",
              "will call immediately my parents",
              "immediately will call my parents"
            ]
          },
          {
            "id": "q7",
            "before": "",
            "after": "",
            "prompt": "David ________.",
            "options": [
              "very much loves his children",
              "loves his children very much",
              "loves very much his children"
            ]
          },
          {
            "id": "q8",
            "before": "",
            "after": "",
            "prompt": "I learnt ______.",
            "options": [
              "Italian in Rome during a student exchange program",
              "Italian during a student exchange program in Rome",
              "in Rome Italian during a student exchange program"
            ]
          },
          {
            "id": "q9",
            "before": "",
            "after": "",
            "prompt": "We ______.",
            "options": [
              "always finish school at 3.30 pm",
              "finish always school at 3.30 pm",
              "finish school at 3.30 pm always"
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": "",
            "prompt": "I _____.",
            "options": [
              "don't play very often tennis",
              "don't like tennis very much",
              "don't like very much tennis"
            ]
          }
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Write sentences using the words in the correct position.",
        "questions": [
          {
            "id": "q1",
            "before": "a nice lunch / had / today / we / at a restaurant ⇒ We ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "the keys / last night / in the car / forgot / He ⇒ He ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "often / Susan / takes / to work / a taxi ⇒ Susan ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "have to return / I / the book / to the library / today ⇒ I ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "are / never / at lunchtime / They / at home ⇒ They ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "It / always / very hot / here / in July / is ⇒ It ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "play / football / after school / in the park / We ⇒ We ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "usually / She / cereal / has / for breakfast ⇒ She ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "met / at a nightclub / in 2006 / Linda / her husband ⇒ Linda ",
            "after": ".",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "always / I / from home / work / on Tuesdays ⇒ I ",
            "after": ".",
            "options": [],
            "kind": "text"
          }
        ],
        "passage": [
          [
            {
              "text": "a nice lunch / had / today / we / at a restaurant ⇒ We "
            },
            {
              "questionId": "q1"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "the keys / last night / in the car / forgot / He ⇒ He "
            },
            {
              "questionId": "q2"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "often / Susan / takes / to work / a taxi ⇒ Susan "
            },
            {
              "questionId": "q3"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "have to return / I / the book / to the library / today ⇒ I "
            },
            {
              "questionId": "q4"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "are / never / at lunchtime / They / at home ⇒ They "
            },
            {
              "questionId": "q5"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "It / always / very hot / here / in July / is ⇒ It "
            },
            {
              "questionId": "q6"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "play / football / after school / in the park / We ⇒ We "
            },
            {
              "questionId": "q7"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "usually / She / cereal / has / for breakfast ⇒ She "
            },
            {
              "questionId": "q8"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "met / at a nightclub / in 2006 / Linda / her husband ⇒ Linda "
            },
            {
              "questionId": "q9"
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "always / I / from home / work / on Tuesdays ⇒ I "
            },
            {
              "questionId": "q10"
            },
            {
              "text": "."
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "a1-the-difference-between-this-and-it",
    "version": 1,
    "level": "a1",
    "category": "grammar",
    "title": "The difference between 'this' and 'it'",
    "subtitle": "A1 grammar · all exercises",
    "cover": {
      "src": "/images/tests/a1-the-difference-between-this-and-it-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "A1 Grammar: The difference between 'this' and 'it'"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Choose the correct option for each gap.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": " isn't nice that you never call.",
            "options": [
              "This",
              "It"
            ]
          },
          {
            "id": "q2",
            "before": "Have you seen their new house? ",
            "after": " has a big garden and a swimming pool.",
            "options": [
              "This",
              "It"
            ]
          },
          {
            "id": "q3",
            "before": "Can you help me with ",
            "after": " problem?",
            "options": [
              "it",
              "this"
            ]
          },
          {
            "id": "q4",
            "before": "",
            "after": " is raining outside.",
            "options": [
              "This",
              "It"
            ]
          },
          {
            "id": "q5",
            "before": "",
            "after": " is my dog’s birthday today.",
            "options": [
              "This",
              "It"
            ]
          },
          {
            "id": "q6",
            "before": "",
            "after": " is late, we should go home.",
            "options": [
              "This",
              "It"
            ]
          },
          {
            "id": "q7",
            "before": "I don’t understand ",
            "after": " word.",
            "options": [
              "this",
              "it"
            ]
          },
          {
            "id": "q8",
            "before": "",
            "after": " is my favorite book.",
            "options": [
              "It",
              "This"
            ]
          },
          {
            "id": "q9",
            "before": "",
            "after": " is a long way to the store.",
            "options": [
              "This",
              "It"
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": " is my new bicycle. Do you like it?",
            "options": [
              "This",
              "It"
            ]
          }
        ],
        "passage": [
          [
            {
              "questionId": "q1"
            },
            {
              "text": " isn't nice that you never call."
            }
          ],
          [
            {
              "text": "Have you seen their new house? "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " has a big garden and a swimming pool."
            }
          ],
          [
            {
              "text": "Can you help me with "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " problem?"
            }
          ],
          [
            {
              "questionId": "q4"
            },
            {
              "text": " is raining outside."
            }
          ],
          [
            {
              "questionId": "q5"
            },
            {
              "text": " is my dog’s birthday today."
            }
          ],
          [
            {
              "questionId": "q6"
            },
            {
              "text": " is late, we should go home."
            }
          ],
          [
            {
              "text": "I don’t understand "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " word."
            }
          ],
          [
            {
              "questionId": "q8"
            },
            {
              "text": " is my favorite book."
            }
          ],
          [
            {
              "questionId": "q9"
            },
            {
              "text": " is a long way to the store."
            }
          ],
          [
            {
              "questionId": "q10"
            },
            {
              "text": " is my new bicycle. Do you like it?"
            }
          ]
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Choose the correct options to complete the sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": "",
            "prompt": "I’m cold because _____ is windy.",
            "options": [
              "this",
              "it"
            ]
          },
          {
            "id": "q2",
            "before": "",
            "after": "",
            "prompt": "_____ is ten miles from my house to the nearest train station.",
            "options": [
              "This",
              "It"
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": "",
            "prompt": "_____ is the teacher who helps me with math.",
            "options": [
              "This",
              "It"
            ]
          },
          {
            "id": "q4",
            "before": "",
            "after": "",
            "prompt": "_____ is my friend Ana; she's from Spain.",
            "options": [
              "This",
              "It"
            ]
          },
          {
            "id": "q5",
            "before": "",
            "after": "",
            "prompt": "_____ was a surprise to see my cousin at the party.",
            "options": [
              "This",
              "It"
            ]
          },
          {
            "id": "q6",
            "before": "",
            "after": "",
            "prompt": "_____ is time for dinner.",
            "options": [
              "This",
              "It"
            ]
          },
          {
            "id": "q7",
            "before": "",
            "after": "",
            "prompt": "Hello, _____ is Michael speaking. May I talk to Sarah, please?",
            "options": [
              "this",
              "it"
            ]
          },
          {
            "id": "q8",
            "before": "",
            "after": "",
            "prompt": "_____ is the best ice cream in town.",
            "options": [
              "This",
              "It"
            ]
          },
          {
            "id": "q9",
            "before": "",
            "after": "",
            "prompt": "This is my new guitar. My wife got _____ for my last birthday.",
            "options": [
              "this",
              "it"
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": "",
            "prompt": "_____ cat is so friendly!",
            "options": [
              "This",
              "It"
            ]
          }
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Write ‘this’ or ‘it’ in each gap to complete this dialogue.",
        "questions": [
          {
            "id": "q1",
            "before": "ALEX: Hey, do you see  ",
            "after": " bike here?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "SAM: Yeah,  ",
            "after": " looks really cool. Is  … new?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "SAM: Yeah,  … looks really cool. Is  ",
            "after": " new?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "ALEX: Yes! I bought  ",
            "after": " yesterday. I also bought  … helmet.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "ALEX: Yes! I bought  … yesterday. I also bought  ",
            "after": " helmet.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "SAM: Nice.  ",
            "after": " is important to be safe.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "ALEX: Of course. And look, I downloaded  ",
            "after": " app on my phone.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "SAM: What is  ",
            "after": " used for?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "ALEX:  ",
            "after": " shows you different routes that you can take and also the time other people took to finish the routes. For example,  … is the route I want to do today.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "ALEX:  … shows you different routes that you can take and also the time other people took to finish the routes. For example,  ",
            "after": " is the route I want to do today.",
            "options": [],
            "kind": "text"
          }
        ],
        "passage": [
          [
            {
              "text": "ALEX: Hey, do you see  "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " bike here?"
            }
          ],
          [
            {
              "text": "SAM: Yeah,  "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " looks really cool. Is  "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " new?"
            }
          ],
          [
            {
              "text": "ALEX: Yes! I bought  "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " yesterday. I also bought  "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " helmet."
            }
          ],
          [
            {
              "text": "SAM: Nice.  "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " is important to be safe."
            }
          ],
          [
            {
              "text": "ALEX: Of course. And look, I downloaded  "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " app on my phone."
            }
          ],
          [
            {
              "text": "SAM: What is  "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " used for?"
            }
          ],
          [
            {
              "text": "ALEX:  "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " shows you different routes that you can take and also the time other people took to finish the routes. For example,  "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " is the route I want to do today."
            }
          ]
        ]
      }
    ]
  }
];
