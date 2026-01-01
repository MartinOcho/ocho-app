import AppLogo from "@/components/AppLogo";
import Buttons from "../Buttons";

export default function Page() {
  return (
    <div className="privacy-policy container mx-auto px-4 max-w-4xl">
      <AppLogo size={100} logo="LOGO" className="text-primary mx-auto"/>
      <h1 className="text-2xl font-bold text-center text-primary mb-4">
        Politique de Confidentialité de OchoApp
      </h1>
      <p className="text-sm text-foreground text-center mb-8">
        Date d&apos;entrée en vigueur : 05 Janvier 2024
      </p>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-muted-foreground mb-3">1. Introduction</h2>
        <p className="text-foreground leading-relaxed">
          Bienvenue sur OchoApp ! Nous nous engageons à protéger votre vie privée et vos données personnelles. Cette politique de confidentialité explique quelles données nous collectons, comment nous les utilisons, et quels sont vos droits en matière de protection des données. En utilisant OchoApp, vous acceptez les pratiques décrites dans cette politique. Si vous n&apos;êtes pas d&apos;accord, veuillez ne pas utiliser notre application.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-muted-foreground mb-3">2. Données que nous collectons</h2>
        <p className="text-foreground mb-4">
          Lorsque vous utilisez OchoApp, nous pouvons collecter les informations suivantes :
        </p>
        <ul className="list-disc list-inside text-foreground space-y-2">
          <li>
            <strong>Nom complet</strong> : Votre nom complet est collecté pour créer votre profil utilisateur. Cela nous permet de personnaliser votre expérience et de vous identifier sur la plateforme.
          </li>
          <li>
            <strong>Adresse e-mail</strong> : Nous collectons votre adresse e-mail pour vous permettre de créer un compte, de réinitialiser votre mot de passe, et de recevoir des notifications importantes.
          </li>
          <li>
            <strong>Données publiques</strong> : Les informations que vous choisissez de rendre publiques, comme vos publications, sont accessibles par tous les utilisateurs de OchoApp. Cela inclut les commentaires, les likes, et les partages.
          </li>
          <li>
            <strong>Publications publiques</strong> : Tout contenu que vous publiez sur OchoApp, y compris les textes, images, et vidéos, est stocké et peut être visible par d&apos;autres utilisateurs. Nous vous recommandons de ne pas partager d&apos;informations sensibles ou personnelles dans vos publications.
          </li>
          <li>
            <strong>Photo de profil</strong> : Votre photo de profil est utilisée pour personnaliser votre compte et est visible par les autres utilisateurs. Vous pouvez la modifier ou la supprimer à tout moment.
          </li>
          <li>
            <strong>Nombre de followers</strong> : Nous collectons et affichons le nombre d&apos;utilisateurs qui vous suivent sur OchoApp. Ces informations sont publiques et font partie de votre profil.
          </li>
          <li>
            <strong>Données techniques</strong> : Nous collectons des informations techniques telles que votre adresse IP, le type de navigateur, le système d&apos;exploitation, et les données de localisation pour améliorer la performance de l&apos;application et détecter les problèmes techniques.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-muted-foreground mb-3">3. Utilisation des données</h2>
        <p className="text-foreground mb-4">
          Les données que nous collectons sont utilisées pour les finalités suivantes :
        </p>
        <ul className="list-disc list-inside text-foreground space-y-2">
          <li>
            <strong>Fournir, maintenir et améliorer nos services</strong> : Nous utilisons vos données pour assurer le bon fonctionnement de OchoApp, résoudre les problèmes techniques, et développer de nouvelles fonctionnalités.
          </li>
          <li>
            <strong>Personnaliser votre expérience utilisateur</strong> : Vos données nous aident à personnaliser votre fil d&apos;actualité, à vous recommander du contenu pertinent, et à adapter l&apos;interface à vos préférences.
          </li>
          <li>
            <strong>Vous connecter avec d&apos;autres utilisateurs</strong> : Nous utilisons vos informations pour faciliter les interactions sociales sur OchoApp, comme les messages, les commentaires, et les notifications.
          </li>
          <li>
            <strong>Analyser l&apos;utilisation de OchoApp</strong> : Nous analysons les données d&apos;utilisation pour comprendre comment les utilisateurs interagissent avec l&apos;application et pour identifier les domaines à améliorer.
          </li>
          <li>
            <strong>Envoyer des communications</strong> : Nous pouvons utiliser votre adresse e-mail pour vous envoyer des mises à jour, des newsletters, et des informations sur les nouvelles fonctionnalités. Vous pouvez vous désabonner à tout moment.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-muted-foreground mb-3">4. Partage des données</h2>
        <p className="text-foreground mb-4">
          Nous ne partageons vos données personnelles qu&apos;avec votre consentement ou dans les cas suivants :
        </p>
        <ul className="list-disc list-inside text-foreground space-y-2">
          <li>
            <strong>Avec des fournisseurs de services tiers</strong> : Nous collaborons avec des tiers pour l&apos;hébergement, l&apos;analyse, et la maintenance de OchoApp. Ces partenaires sont tenus de respecter des obligations de confidentialité strictes.
          </li>
          <li>
            <strong>Pour répondre à des obligations légales</strong> : Nous pouvons partager vos données si la loi l&apos;exige, par exemple en réponse à une demande judiciaire ou à une enquête gouvernementale.
          </li>
          <li>
            <strong>En cas de fusion ou d&apos;acquisition</strong> : Si OchoApp est racheté ou fusionné avec une autre entreprise, vos données pourront être transférées à la nouvelle entité. Nous vous informerons de tout changement de propriétaire.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-muted-foreground mb-3">5. Sécurité des données</h2>
        <p className="text-foreground leading-relaxed">
          Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles pour protéger vos données contre tout accès non autorisé, altération, divulgation ou destruction. Ces mesures incluent :
        </p>
        <ul className="list-disc list-inside text-foreground space-y-2 mt-2">
          <li>Chiffrement des données lors de leur transmission et de leur stockage.</li>
          <li>Contrôles d&apos;accès stricts pour limiter l&apos;accès aux données sensibles.</li>
          <li>Surveillance régulière de nos systèmes pour détecter les failles de sécurité.</li>
        </ul>
        <p className="text-foreground mt-4">
          Malgré nos efforts, aucune méthode de transmission ou de stockage n&apos;est totalement sécurisée. Si vous avez des raisons de croire que vos données ont été compromises, veuillez nous contacter immédiatement.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-muted-foreground mb-3">6. Vos droits</h2>
        <p className="text-foreground mb-4">
          Conformément aux lois sur la protection des données, vous disposez des droits suivants :
        </p>
        <ul className="list-disc list-inside text-foreground space-y-2">
          <li>
            <strong>Accéder à vos données</strong> : Vous pouvez demander une copie des données personnelles que nous détenons à votre sujet.
          </li>
          <li>
            <strong>Corriger vos données</strong> : Si vos informations sont inexactes ou incomplètes, vous pouvez demander à les mettre à jour.
          </li>
          <li>
            <strong>Supprimer vos données</strong> : Vous pouvez demander la suppression de vos données personnelles, sous réserve de certaines exceptions légales.
          </li>
          <li>
            <strong>Vous opposer au traitement</strong> : Vous pouvez vous opposer à l&apos;utilisation de vos données pour des raisons liées à votre situation particulière.
          </li>
          <li>
            <strong>Retirer votre consentement</strong> : Si nous traitons vos données sur la base de votre consentement, vous pouvez le retirer à tout moment.
          </li>
        </ul>
        <p className="text-foreground mt-4">
          Pour exercer ces droits, contactez-nous à l&apos;adresse suivante :{" "}
          <a href="mailto:ochokom@ochotouchsolution.onmicrosoft.com" className="text-primary underline">
            ochokom@ochotouchsolution.onmicrosoft.com
          </a>
          . Nous répondrons à votre demande dans les délais légaux.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-muted-foreground mb-3">7. Modifications de la politique de confidentialité</h2>
        <p className="text-foreground leading-relaxed">
          Nous pouvons mettre à jour cette politique de confidentialité de temps à autre pour refléter les changements dans nos pratiques ou les exigences légales. Nous vous informerons de tout changement significatif en publiant la nouvelle politique sur cette page ou en vous envoyant une notification. Nous vous encourageons à consulter régulièrement cette politique pour rester informé.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-muted-foreground mb-3">8. Contact</h2>
        <p className="text-foreground leading-relaxed">
          Si vous avez des questions concernant cette politique de confidentialité ou si vous souhaitez exercer vos droits, vous pouvez nous contacter à l&apos;adresse suivante :{" "}
          <a href="mailto:ochokom@ochotouchsolution.onmicrosoft.com" className="text-primary underline">
            ochokom@ochotouchsolution.onmicrosoft.com
          </a>
          . Nous nous engageons à répondre à vos demandes dans les meilleurs délais.
        </p>
      </section>
      <section>
        <Buttons />
      </section>
    </div>
  );
}