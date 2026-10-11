import type { TestCatalogEntry } from "./types";

/** Inert public content imported from the user's saved HTML; no answers or scripts. */
export const FOLDER_TESTS: TestCatalogEntry[] = [
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
    "id": "a1-adjectives",
    "version": 1,
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
      }
    ]
  },
  {
    "id": "third-conditional",
    "version": 1,
    "level": "b1",
    "category": "grammar",
    "title": "Third conditional",
    "subtitle": "Past unreal situations",
    "cover": {
      "src": "/images/tests/third-conditional-v1.webp",
      "width": 1200,
      "height": 600,
      "alt": "B1 Grammar: Third conditional"
    },
    "exercises": [
      {
        "id": "exercise-1",
        "number": 1,
        "instruction": "Choose the correct form to make third conditional sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "If you had trained more, you ",
            "after": " so easily.",
            "options": [
              "didn't lose",
              "wouldn't have lost",
              "hadn't lost"
            ]
          },
          {
            "id": "q2",
            "before": "We wouldn't have spent all the money if you ",
            "after": " on going to that boutique.",
            "options": [
              "didn't insist",
              "wouldn't have insisted",
              "hadn't insisted"
            ]
          },
          {
            "id": "q3",
            "before": "If you had told me that you were having problems, I ",
            "after": " you.",
            "options": [
              "could have helped",
              "had helped",
              "would help"
            ]
          },
          {
            "id": "q4",
            "before": "If I ",
            "after": " that she was in town, I would have called her.",
            "options": [
              "would have known",
              "had known",
              "would know"
            ]
          },
          {
            "id": "q5",
            "before": "If she had offered a better price for the car, I ",
            "after": " it.",
            "options": [
              "had bought",
              "would buy",
              "might have bought"
            ]
          },
          {
            "id": "q6",
            "before": "There wouldn't have been so many problems if they ",
            "after": " the race a bit better.",
            "options": [
              "had organised",
              "organised",
              "would have organised"
            ]
          },
          {
            "id": "q7",
            "before": "We ",
            "after": " lost if you had asked for directions.",
            "options": [
              "hadn't got",
              "wouldn't have got",
              "wouldn't get"
            ]
          },
          {
            "id": "q8",
            "before": "We would never have met if you ",
            "after": " us to each other at that party.",
            "options": [
              "hadn't introduced",
              "wouldn't have introduced",
              "hasn't introduced"
            ]
          },
          {
            "id": "q9",
            "before": "If she had embarrassed me in front of all my friends, I ",
            "after": " her for ever.",
            "options": [
              "would have hated",
              "had hated",
              "will hate"
            ]
          },
          {
            "id": "q10",
            "before": "I ",
            "after": " her life if I had paid more attention.",
            "options": [
              "had saved",
              "could have saved",
              "would save"
            ]
          }
        ],
        "passage": [
          [
            {
              "text": "If you had trained more, you "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " so easily."
            }
          ],
          [
            {
              "text": "We wouldn't have spent all the money if you "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " on going to that boutique."
            }
          ],
          [
            {
              "text": "If you had told me that you were having problems, I "
            },
            {
              "questionId": "q3"
            },
            {
              "text": " you."
            }
          ],
          [
            {
              "text": "If I "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " that she was in town, I would have called her."
            }
          ],
          [
            {
              "text": "If she had offered a better price for the car, I "
            },
            {
              "questionId": "q5"
            },
            {
              "text": " it."
            }
          ],
          [
            {
              "text": "There wouldn't have been so many problems if they "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " the race a bit better."
            }
          ],
          [
            {
              "text": "We "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " lost if you had asked for directions."
            }
          ],
          [
            {
              "text": "We would never have met if you "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " us to each other at that party."
            }
          ],
          [
            {
              "text": "If she had embarrassed me in front of all my friends, I "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " her for ever."
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
              "text": " her life if I had paid more attention."
            }
          ]
        ]
      },
      {
        "id": "exercise-2",
        "number": 2,
        "instruction": "Choose the correct form to make third conditional sentences.",
        "questions": [
          {
            "id": "q1",
            "before": "",
            "after": "",
            "prompt": "You ______ me if you had gone to the party. Choose TWO correct options",
            "options": [
              "would have seen",
              "could see",
              "might have seen"
            ],
            "kind": "multiple",
            "selectionCount": 2
          },
          {
            "id": "q2",
            "before": "",
            "after": "",
            "prompt": "What would you have done if I ______?",
            "options": [
              "didn't come",
              "wouldn't come",
              "hadn't come"
            ]
          },
          {
            "id": "q3",
            "before": "",
            "after": "",
            "prompt": "They ______ him if I ______ them the money.",
            "options": [
              "would have killed / didn't give",
              "would have killed / hadn't given",
              "had killed him / wouldn't give"
            ]
          },
          {
            "id": "q4",
            "before": "",
            "after": "",
            "prompt": "If I had stayed in university, I ______ much better jobs.",
            "options": [
              "will get",
              "had got",
              "could have got"
            ]
          },
          {
            "id": "q5",
            "before": "",
            "after": "",
            "prompt": "If I ______ so hard all my life, I might have spent more time with my kids.",
            "options": [
              "hadn't worked",
              "wouldn't have worked",
              "didn't work"
            ]
          },
          {
            "id": "q6",
            "before": "",
            "after": "",
            "prompt": "If I had been feeling well, I ______ the steak. Choose TWO correct options",
            "options": [
              "might have ordered",
              "could have ordered",
              "will have ordered"
            ],
            "kind": "multiple",
            "selectionCount": 2
          },
          {
            "id": "q7",
            "before": "",
            "after": "",
            "prompt": "If I'd known you were going, I ______ with you.",
            "options": [
              "would come",
              "had come",
              "would have come"
            ]
          },
          {
            "id": "q8",
            "before": "",
            "after": "",
            "prompt": "I ______ the exam even if I had studied harder.",
            "options": [
              "wouldn't pass",
              "wouldn't have passed",
              "hadn't passed"
            ]
          },
          {
            "id": "q9",
            "before": "",
            "after": "",
            "prompt": "If I ______ you the truth, you wouldn't have believed me.",
            "options": [
              "told",
              "would have told",
              "had told"
            ]
          },
          {
            "id": "q10",
            "before": "",
            "after": "",
            "prompt": "He ______ the accident if he hadn't drunk.",
            "options": [
              "wouldn't have had",
              "wouldn't have",
              "hadn't had"
            ]
          }
        ]
      },
      {
        "id": "exercise-3",
        "number": 3,
        "instruction": "Fill in the gaps with the verbs in brackets in the correct form to make third conditional sentences with would.",
        "questions": [
          {
            "id": "q1",
            "before": "If we ",
            "after": " (have) the money, we … (go).",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q2",
            "before": "If we … (have) the money, we ",
            "after": " (go).",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q3",
            "before": "I ",
            "after": " (tidy up) the house if I … (know) that you were coming.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q4",
            "before": "I … (tidy up) the house if I ",
            "after": " (know) that you were coming.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q5",
            "before": "We ",
            "after": " (bring) some snacks if you … (tell) us about the picnic.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q6",
            "before": "We … (bring) some snacks if you ",
            "after": " (tell) us about the picnic.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q7",
            "before": "Obviously, if my parents ",
            "after": " (not meet), I … (not be born).",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q8",
            "before": "Obviously, if my parents … (not meet), I ",
            "after": " (not be born).",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q9",
            "before": "If he ",
            "after": " (invest) in that business, he … (lose) everything.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q10",
            "before": "If he … (invest) in that business, he ",
            "after": " (lose) everything.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q11",
            "before": "If the police ",
            "after": " (not be) nearby, there … (be) many more victims.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q12",
            "before": "If the police … (not be) nearby, there ",
            "after": " (be) many more victims.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q13",
            "before": "What ",
            "after": " (you/do) if you … (be) in that situation?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q14",
            "before": "What … (you/do) if you ",
            "after": " (be) in that situation?",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q15",
            "before": "The police ",
            "after": " (not catch) him if he … (not make) that little mistake.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q16",
            "before": "The police … (not catch) him if he ",
            "after": " (not make) that little mistake.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q17",
            "before": "If I ",
            "after": " (know) there was a party, I … (wear) something nicer.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q18",
            "before": "If I … (know) there was a party, I ",
            "after": " (wear) something nicer.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q19",
            "before": "It ",
            "after": " (be) easier if you … (tell) me what I needed to do.",
            "options": [],
            "kind": "text"
          },
          {
            "id": "q20",
            "before": "It … (be) easier if you ",
            "after": " (tell) me what I needed to do.",
            "options": [],
            "kind": "text"
          }
        ],
        "passage": [
          [
            {
              "text": "If we "
            },
            {
              "questionId": "q1"
            },
            {
              "text": " (have) the money, we "
            },
            {
              "questionId": "q2"
            },
            {
              "text": " (go)."
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
              "text": " (tidy up) the house if I "
            },
            {
              "questionId": "q4"
            },
            {
              "text": " (know) that you were coming."
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
              "text": " (bring) some snacks if you "
            },
            {
              "questionId": "q6"
            },
            {
              "text": " (tell) us about the picnic."
            }
          ],
          [
            {
              "text": "Obviously, if my parents "
            },
            {
              "questionId": "q7"
            },
            {
              "text": " (not meet), I "
            },
            {
              "questionId": "q8"
            },
            {
              "text": " (not be born)."
            }
          ],
          [
            {
              "text": "If he "
            },
            {
              "questionId": "q9"
            },
            {
              "text": " (invest) in that business, he "
            },
            {
              "questionId": "q10"
            },
            {
              "text": " (lose) everything."
            }
          ],
          [
            {
              "text": "If the police "
            },
            {
              "questionId": "q11"
            },
            {
              "text": " (not be) nearby, there "
            },
            {
              "questionId": "q12"
            },
            {
              "text": " (be) many more victims."
            }
          ],
          [
            {
              "text": "What "
            },
            {
              "questionId": "q13"
            },
            {
              "text": " (you/do) if you "
            },
            {
              "questionId": "q14"
            },
            {
              "text": " (be) in that situation?"
            }
          ],
          [
            {
              "text": "The police "
            },
            {
              "questionId": "q15"
            },
            {
              "text": " (not catch) him if he "
            },
            {
              "questionId": "q16"
            },
            {
              "text": " (not make) that little mistake."
            }
          ],
          [
            {
              "text": "If I "
            },
            {
              "questionId": "q17"
            },
            {
              "text": " (know) there was a party, I "
            },
            {
              "questionId": "q18"
            },
            {
              "text": " (wear) something nicer."
            }
          ],
          [
            {
              "text": "It "
            },
            {
              "questionId": "q19"
            },
            {
              "text": " (be) easier if you "
            },
            {
              "questionId": "q20"
            },
            {
              "text": " (tell) me what I needed to do."
            }
          ]
        ]
      }
    ]
  }
];
