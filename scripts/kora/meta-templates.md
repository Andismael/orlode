# Kora — Templates WhatsApp à soumettre à Meta

Ces 2 templates sont nécessaires pour que Kora puisse contacter un utilisateur **hors** de la fenêtre 24h (proactivité matinale + rappels programmés).

Approbation Meta : 24-48h. Ils ne sont PAS bloquants pour le chat web ni pour les réponses dans la fenêtre 24h après un message inbound — donc tu peux tester le produit avant qu'ils soient approuvés.

## Argumentaire pour le formulaire Meta

> **Use case**: Personal AI assistant for entrepreneurs and business owners. Reminders are user-initiated tasks. Morning check-ins are opt-in scheduled by the user during onboarding (the user picks the hour). All messages are personalized to a specific user who has explicitly consented.
>
> NOT a general-purpose AI companion. The assistant has a defined set of capabilities: reminders, task notes, delegation to other business agents inside our Orlode workspace.

---

## 1. `kora_morning_checkin`

| Champ | Valeur |
|---|---|
| Name | `kora_morning_checkin` |
| Category | **UTILITY** |
| Language | French (`fr`) |
| Header | (none) |
| Footer | `Kora · Orlode AI` |
| Buttons | (none) |

**Body** :

```
{{1}}
```

**Sample body value** (utilisé par Meta pour valider, mais ce qui sera envoyé est le message dynamique généré par le LLM) :

```
Salut Ismael. Hier tu galérais avec le déploiement Cloud Run — c'est résolu ou ça traîne encore ?
```

---

## 2. `kora_reminder`

| Champ | Valeur |
|---|---|
| Name | `kora_reminder` |
| Category | **UTILITY** |
| Language | French (`fr`) |
| Header | (none) |
| Footer | `Kora · Orlode AI` |
| Buttons | (none) |

**Body** :

```
{{1}}
```

**Sample body value** :

```
Rappel : Appeler le fournisseur Diallo. Contexte : "On lui doit la confirmation de la commande de 50 sacs avant midi."
```

---

## Étapes d'envoi

1. Va sur https://business.facebook.com/wa/manage/message-templates/
2. Sélectionne le bon **WhatsApp Business Account** (celui d'Orlode CorpMind, pas EburnieFarmers).
3. Pour chaque template :
   - Click **Create Template**
   - Catégorie : **Utility**
   - Langue : **French**
   - Header : *None*
   - Body : `{{1}}` (juste la variable)
   - Footer : `Kora · Orlode AI`
   - Buttons : aucun
   - Sample body : remplis avec un exemple réel (voir ci-dessus)
4. **Submit for review**.
5. Tu reçois un email Meta quand le statut passe à `APPROVED` (typiquement 1-24h, max 48h).

## Si Meta rejette

Le motif le plus fréquent en 2026 est "General purpose AI prohibited". Si ça arrive :
- Re-soumets avec une description plus restrictive : `"Personal productivity assistant for entrepreneurs. Sends scheduled reminders and morning briefings the user has opted into. Does not engage in open-ended conversation outside these defined tasks."`
- Évite les mots `companion`, `chat`, `AI friend`, `general AI`.

## Côté code

Une fois approuvés, les `name` des templates (`kora_morning_checkin`, `kora_reminder`) doivent matcher exactement les valeurs utilisées dans `kora.routes.ts` (cron handlers) si on bascule plus tard sur des envois template-only. Pour V1 on envoie en service window (réponse à un inbound) donc texte libre — aucune action template requise pour démo immédiate.
