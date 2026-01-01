import OchoLink from "@/components/ui/OchoLink";
import Buttons from "../Buttons";
import AppLogo from "@/components/AppLogo";

export default function Page() {
  return (
    <div className="terms-of-use container mx-auto max-w-4xl p-4">
      <AppLogo size={100} logo="LOGO" className="text-primary mx-auto"/>
      <h1 className="mb-4 text-center text-2xl font-bold text-primary">
        Conditions d&apos;Utilisation de OchoApp
      </h1>
      <p className="mb-8 text-center text-sm text-foreground">
        Date d&apos;entrée en vigueur : 05 Janvier 2024
      </p>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-semibold text-muted-foreground">
          1. Accepter les Règles
        </h2>
        <p className="leading-relaxed text-foreground">
          En utilisant OchoApp, vous acceptez ces règles. Cela signifie que vous
          vous engagez à respecter tout ce qui est écrit ici. Si vous
          n&apos;êtes pas d&apos;accord avec une partie ou la totalité de ces
          règles, il est préférable de ne pas utiliser l&apos;application. En
          continuant à utiliser OchoApp, vous montrez que vous acceptez ces
          conditions. Ces règles constituent un contrat légal entre vous et
          OchoApp, et elles régissent votre utilisation de l&apos;application.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-semibold text-muted-foreground">
          2. Comment Utiliser OchoApp
        </h2>
        <p className="mb-4 text-foreground">
          Vous devez utiliser OchoApp de manière légale, respectueuse et
          conforme à ces règles. Voici ce que vous ne devez pas faire :
        </p>
        <ul className="list-inside list-disc space-y-2 text-foreground">
          <li>
            <strong>Activités illégales :</strong> Ne pas utiliser OchoApp pour
            des activités interdites par la loi, telles que le harcèlement, la
            fraude, ou la diffusion de contenu illégal.
          </li>
          <li>
            <strong>Contenu inapproprié :</strong> Ne pas publier de contenu
            blessant, insultant, faux, diffamatoire, obscène, ou qui pourrait
            nuire à d&apos;autres personnes. Cela inclut les contenus à
            caractère raciste, sexiste, ou discriminatoire.
          </li>
          <li>
            <strong>Accès non autorisé :</strong> Ne pas essayer d&apos;accéder
            à des comptes, des informations ou des données qui ne vous
            appartiennent pas. Cela inclut le piratage, le phishing, ou toute
            autre méthode d&apos;accès illicite.
          </li>
          <li>
            <strong>Outils automatisés :</strong> Ne pas utiliser de robots, de
            logiciels, de scripts, ou d&apos;autres moyens automatisés pour
            interagir avec OchoApp sans notre permission explicite. Cela inclut
            le scraping de données ou l&apos;envoi massif de requêtes.
          </li>
          <li>
            <strong>Spam :</strong> Ne pas envoyer de messages non sollicités,
            de publicités, ou de contenus promotionnels à d&apos;autres
            utilisateurs sans leur consentement.
          </li>
        </ul>
        <p className="mt-4 text-foreground">
          Si vous ne respectez pas ces règles, nous pouvons suspendre ou fermer
          votre compte, et nous nous réservons le droit de prendre des mesures
          légales si nécessaire.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-semibold text-muted-foreground">
          3. Votre Compte
        </h2>
        <p className="mb-4 text-foreground">
          Pour utiliser certaines fonctionnalités de OchoApp, vous devez créer
          un compte. Voici ce que vous devez savoir :
        </p>
        <ul className="list-inside list-disc space-y-2 text-foreground">
          <li>
            <strong>Informations exactes :</strong> Vous devez fournir des
            informations vraies, exactes et à jour lors de la création de votre
            compte. Cela inclut votre nom, votre adresse e-mail, et toute autre
            information requise.
          </li>
          <li>
            <strong>Protection du compte :</strong> Vous êtes responsable de la
            sécurité de votre mot de passe et de tout ce qui se passe sur votre
            compte. Ne partagez pas votre mot de passe avec d&apos;autres
            personnes. Utilisez un mot de passe fort et changez-le
            régulièrement.
          </li>
          <li>
            <strong>Utilisation non autorisée :</strong> Si vous remarquez que
            quelqu&apos;un utilise votre compte sans votre permission, vous
            devez nous en informer immédiatement à l&apos;adresse{" "}
            <strong>ochokom@ochotouchsolution.onmicrosoft.com</strong>.
          </li>
          <li>
            <strong>Comptes multiples :</strong> La création de plusieurs
            comptes pour contourner des restrictions ou des sanctions est
            interdite.
          </li>
        </ul>
        <p className="mt-4 text-foreground">
          Si vous perdez l&apos;accès à votre compte, nous pouvons vous aider à
          le récupérer, mais vous devez prouver que vous en êtes le propriétaire
          en fournissant les informations nécessaires.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-semibold text-muted-foreground">
          4. Ce Que Vous Partagez
        </h2>
        <p className="mb-4 text-foreground">
          Vous gardez tous les droits sur le contenu que vous publiez sur
          OchoApp. Cela signifie que vous en restez le propriétaire. Cependant,
          en partageant du contenu sur OchoApp, vous nous autorisez à
          l&apos;utiliser pour faire fonctionner et améliorer
          l&apos;application. Par exemple, nous pouvons afficher votre contenu à
          d&apos;autres utilisateurs ou l&apos;utiliser pour promouvoir OchoApp.
          Cette autorisation est mondiale, non exclusive, et gratuite.
        </p>
        <p className="text-foreground">
          Vous êtes responsable de tout ce que vous publiez. Assurez-vous que
          votre contenu ne viole pas les droits d&apos;autrui ou les lois en
          vigueur. Si vous partagez quelque chose d&apos;inapproprié, nous
          pouvons le supprimer et prendre des mesures contre votre compte, y
          compris la suspension ou la fermeture de celui-ci.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-semibold text-muted-foreground">
          5. Respect de la Propriété
        </h2>
        <p className="leading-relaxed text-foreground">
          Tout ce qui est sur OchoApp (comme les logos, les designs, les textes,
          les images, etc.) est protégé par des droits d&apos;auteur, des
          marques déposées, et d&apos;autres lois. Cela signifie que vous ne
          pouvez pas copier, modifier, distribuer, ou utiliser ces éléments sans
          notre permission écrite. Si vous souhaitez utiliser quelque chose de
          OchoApp, contactez-nous d&apos;abord pour obtenir une autorisation.
          Toute utilisation non autorisée de notre propriété intellectuelle peut
          entraîner des poursuites judiciaires.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-semibold text-muted-foreground">
          6. Notre Responsabilité
        </h2>
        <p className="leading-relaxed text-foreground">
          OchoApp est fourni &quot;tel quel&quot;. Cela signifie que nous ne
          garantissons pas que l&apos;application fonctionnera toujours sans
          problème, qu&apos;elle sera sécurisée à 100 %, ou qu&apos;elle sera
          exempte d&apos;erreurs. Nous faisons de notre mieux pour vous offrir
          un service de qualité, mais nous ne pouvons pas tout prévoir. Nous
          déclinons toute responsabilité pour les dommages indirects, comme la
          perte de données, les interruptions de service, ou les dommages
          financiers, qui pourraient survenir lors de l&apos;utilisation de
          OchoApp. Cependant, nous nous engageons à résoudre les problèmes
          techniques dans les meilleurs délais.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-semibold text-muted-foreground">
          7. Arrêt de l&apos;Accès
        </h2>
        <p className="leading-relaxed text-foreground">
          Nous pouvons suspendre ou arrêter votre accès à OchoApp à tout moment,
          sans préavis, si vous ne respectez pas ces règles. Par exemple, si
          vous utilisez OchoApp de manière abusive, si vous partagez du contenu
          interdit, ou si vous tentez de nuire à l&apos;application ou à ses
          utilisateurs, nous pouvons fermer votre compte. Vous pouvez également
          fermer votre compte à tout moment si vous ne souhaitez plus utiliser
          OchoApp. Dans ce cas, vos données seront supprimées conformément à
          notre politique de confidentialité, sauf si la loi nous oblige à les
          conserver.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-semibold text-muted-foreground">
          8. Changements des Règles
        </h2>
        <p className="leading-relaxed text-foreground">
          Nous pouvons modifier ces règles à tout moment. Par exemple, si nous
          ajoutons de nouvelles fonctionnalités à OchoApp ou si nous devons nous
          conformer à de nouvelles lois, nous mettrons à jour ces conditions.
          Les nouvelles règles seront applicables dès leur publication sur cette
          page. Il est de votre responsabilité de consulter régulièrement cette
          page pour rester informé des changements. Si vous continuez à utiliser
          OchoApp après la publication des nouvelles règles, cela signifie que
          vous les acceptez. Nous vous informerons des changements majeurs par
          e-mail ou via une notification dans l&apos;application.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-semibold text-muted-foreground">
          9. Nous Contacter
        </h2>
        <p className="leading-relaxed text-foreground">
          Si vous avez des questions sur ces règles ou si vous rencontrez un
          problème avec OchoApp, vous pouvez nous contacter à l&apos;adresse
          suivante :{" "}
          <strong>
            <a
              href="mailto:ochokom@ochotouchsolution.onmicrosoft.com"
              className="text-ellipsis text-primary underline"
            >
              ochokom@ochotouchsolution.onmicrosoft.com
            </a>
          </strong>
          . Nous ferons de notre mieux pour vous répondre rapidement et vous
          aider à résoudre tout problème. Vous pouvez également consulter notre
          centre d&apos;aide en ligne pour trouver des réponses à vos questions.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-semibold text-muted-foreground">
          10. Politique de Confidentialité
        </h2>
        <p className="leading-relaxed text-foreground">
          Votre vie privée est importante pour nous. Nous collectons et
          utilisons vos informations personnelles conformément à notre politique
          de confidentialité. En utilisant OchoApp, vous acceptez que nous
          traitions vos données comme décrit dans cette politique. Nous ne
          partagerons jamais vos informations avec des tiers sans votre
          consentement, sauf si la loi l&apos;exige. Pour en savoir plus sur
          comment nous protégeons vos données, veuillez consulter notre{" "}
          <OchoLink
            href="/privacy"
            className="text-primary hover:underline max-sm:underline"
          >
            politique de confidentialité
          </OchoLink>
          .
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-semibold text-muted-foreground">
          11. Limitation de Responsabilité
        </h2>
        <p className="leading-relaxed text-foreground">
          Dans la mesure permise par la loi, OchoApp ne sera pas responsable des
          dommages directs, indirects, spéciaux, consécutifs ou exemplaires, y
          compris, mais sans s&apos;y limiter, la perte de profits, de données,
          d&apos;utilisation, de goodwill, ou d&apos;autres pertes intangibles
          résultant de (i) votre accès à ou utilisation de ou incapacité à
          accéder ou à utiliser le service; (ii) toute conduite ou contenu de
          tout tiers sur le service; (iii) tout contenu obtenu à partir du
          service; et (iv) tout accès non autorisé, utilisation ou altération de
          vos transmissions ou contenu, que la responsabilité soit basée sur la
          garantie, le contrat, la responsabilité délictuelle (y compris la
          négligence) ou toute autre théorie légale, que nous ayons été informés
          ou non de la possibilité de tels dommages.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-semibold text-muted-foreground">
          12. Loi Applicable et Résolution des Litiges
        </h2>
        <p className="leading-relaxed text-foreground">
          Ces conditions d&apos;utilisation sont régies par les lois du pays où
          OchoApp est basé. Tout litige découlant de ces conditions ou de votre
          utilisation de OchoApp sera résolu par les tribunaux compétents de ce
          pays. En cas de litige, nous vous encourageons à nous contacter
          d&apos;abord pour essayer de résoudre le problème de manière amiable.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-semibold text-muted-foreground">
          13. Bienvenue
        </h2>
        <p className="mb-3 leading-relaxed text-foreground">
          Nous vous souhaitons la bienvenue sur notre application et espérons
          que vous apprécierez votre expérience avec OchoApp. Si vous avez des
          questions ou des suggestions, n&apos;hésitez pas à nous contacter.
        </p>
        <Buttons />
      </section>
    </div>
  );
}
