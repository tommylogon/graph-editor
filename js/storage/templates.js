// Person/Event property templates
export const templatesMixin = {
    getPersonTemplate(label = "New Person") {
        return {
            metadata: {
                version: "1.0",
                last_updated: new Date().toISOString().split('T')[0],
                source: "Editor",
                notes: "",
                image_prompt: ""
            },
            basic_info: {
                name: {
                    full: label,
                    first: "",
                    last: "",
                    nicknames: [],
                    aliases: []
                },
                age: 25,
                birthdate: "",
                gender: "",
                pronouns: "",
                species: "Human",
                nationality: "",
                ethnicity: "",
                occupation: "",
                residence: {
                    type: "",
                    name: "",
                    unit: "",
                    area: "",
                    full_address: ""
                },
                marital_status: "Single",
                partner: null
                // removed: family (now in relationships), sexuality (now in kinks)
            },
            appearance: {
                overview: "",
                height: { value: 0, unit: "cm", imperial: "" },
                build: "",
                skin: { tone: "", condition: "", distinguishing_features: [] },
                hair: { color: "", length: "", style: "", accessories: [] },
                eyes: { color: "", shape: "", special: "" },
                face: { shape: "", features: [], makeup: "" },
                body: {
                    chest: { size: "", description: "" },
                    waist: "",
                    hips: "",
                    legs: "",
                    butt: "",
                    other: []
                },
                genitalia: {
                    pubic_hair: "",
                    vaginal_description: "",
                    penis_description: ""
                },
                style: { clothing: [], accessories: [], footwear: [] },
                scent: "",
                voice: { pitch: "", accent: "", mannerisms: "" }
            },
            personality: {
                traits: [],
                mbti: "",
                alignment: "",          // kept here
                likes: [],
                dislikes: [],
                fears: [],
                aspirations: [],
                quirks: [],
                habits: [],
                speech_pattern: { style: "", dialect: "", catchphrases: [] }
            },
            biography: {
                early_life: {
                    place_of_birth: "",
                    family_background: "",
                    key_events: []
                },
                adulthood: {
                    education: [],
                    career_history: [],
                    relationships: [],
                    children: [],
                    significant_life_events: []
                },
                current_situation: ""
            },
            relationships: {
                family: {                // moved family here
                    parents: [],
                    siblings: [],
                    children: [],
                    other_relations: []
                },
                connections: [],         // keep both? your call
                friends: [],
                enemies: [],
                rivals: [],
                mentors: [],
                protégés: []
            },
            secrets: {
                deepest_secret: "",
                hidden_facts: [],
                known_by: []
            },
            capabilities: {
                skills: [],
                languages: [],
                weaknesses: []
            },
            kinks_and_sexuality: {
                orientation: "",         // single source of truth
                experience: "",
                preferences: [],
                turn_ons: [],
                turn_offs: [],
                curiosities: [],
                boundaries: []
            },
            narrative: {
                arc: "",
                potential_storylines: [],
                role_in_town: ""
            },
            example_dialogues: [],
            media: {
                favorite_movies: [],
                favorite_music: [],
                favorite_books: []
            }
        };
    },

    getEventTemplate(label = "New Event") {
        return {
            description: "",
            start_date: "",
            end_date: "",
            location: "",
            participants: [],
            outcome: "",
            notes: ""
        };
    }
};
