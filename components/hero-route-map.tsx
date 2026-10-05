import { memo, type CSSProperties } from 'react';
import styles from './hero-route-map.module.css';

const route =
  'M 76 380 L 166 380 Q 184 380 184 362 L 184 302 Q 184 284 202 284 L 294 284 Q 312 284 312 266 L 312 190 Q 312 172 330 172 L 414 172 Q 432 172 432 154 L 432 116';

/** Decorative city map: CSS motion only, no timers, requests or location access. */
export const HeroRouteMap = memo(function HeroRouteMap() {
  return (
    <figure
      className={styles.card}
      style={{ '--route-path': `path('${route}')` } as CSSProperties}
      aria-label="Mapa ilustrativo com uma rota até a Subúrbio"
    >
      <div className={styles.top}>
        <span className={styles.badge}>
          <i /> GPS
        </span>
        <span>PRÓXIMA PARADA / SUBÚRBIO</span>
      </div>
      <svg className={styles.map} viewBox="0 0 540 480" fill="none" aria-hidden="true">
        <g className={styles.blocks} fill="#101f2b" stroke="#203440" strokeWidth="1">
          <path d="M24 56H148V142H24Z M24 174H148V250H24Z M24 284H148V346H24Z M24 414H148V464H24Z M218 54H278V140H218Z M218 174H278V250H218Z M218 318H278V446H218Z M346 54H398V140H346Z M346 206H398V250H346Z M346 284H458V346H346Z M346 380H458V456H346Z M466 54H526V140H466Z M466 174H526V250H466Z" />
        </g>
        <g stroke="#2b4656" strokeWidth="2" opacity=".65">
          <path d="M0 158H540 M0 268H540 M0 398H318L338 366H540 M166 0V480 M296 0V480 M416 0V268 M480 268V480" />
          <path
            className={styles.detail}
            d="M0 28H540 M0 464H540 M12 0V480 M528 0V480 M202 0V480 M328 0V480"
            strokeWidth="1"
          />
        </g>
        <path
          d="M506 -20C448 44 500 98 508 150S558 232 516 306S494 426 558 482"
          stroke="#143549"
          strokeWidth="24"
          opacity=".65"
        />
        <g className={styles.detail} fill="#567587" fontSize="8" letterSpacing="3" fontFamily="sans-serif">
          <text x="35" y="119">
            SEU CAMINHO
          </text>
          <text x="351" y="431">
            SUA HISTÓRIA
          </text>
        </g>
        <path className={styles.routeGlow} d={route} pathLength="1" stroke="#44cfff" strokeWidth="12" opacity=".08" />
        <path d={route} stroke="#44cfff" strokeWidth="3" opacity=".2" />
        <path
          className={styles.route}
          d={route}
          pathLength="1"
          stroke="#65dcff"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="76" cy="380" r="5" fill="#0b1721" stroke="#71dfff" strokeWidth="2" />
        <g className={styles.destination}>
          <circle className={styles.pulse} cx="432" cy="116" r="18" stroke="#65dcff" />
          <circle cx="432" cy="116" r="12" fill="#102e40" stroke="#65dcff" />
          <path d="m427 117 5-7 5 7-5-2Z" fill="#e3faff" />
        </g>
        <g className={styles.travelerMotion}>
          <circle className={styles.travelerHalo} r="12" fill="#65dcff" opacity=".16" />
          <circle className={styles.traveler} r="4" fill="#effcff" stroke="#65dcff" strokeWidth="2" />
        </g>
        <g fill="#d6f5ff" fontFamily="sans-serif">
          <text x="353" y="78" fontSize="10" letterSpacing="3">
            SUBÚRBIO RP
          </text>
        </g>
      </svg>
      <figcaption className={styles.caption}>
        <div>
          <span>ENCONTRE SEU LUGAR</span>
          <strong>Seu destino é a Subúrbio.</strong>
        </div>
        <span className={styles.arrow} aria-hidden="true">
          ↗
        </span>
      </figcaption>
      <div className={styles.bottom}>
        <span>UMA CIDADE. INFINITOS CAMINHOS.</span>
        <span>01 / BR</span>
      </div>
    </figure>
  );
});
