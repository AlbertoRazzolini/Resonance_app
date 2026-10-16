package it.epicode.resonance.moderation;

import org.springframework.core.convert.converter.Converter;
import org.springframework.stereotype.Component;

/**
 * Converte il segmento {type} degli URL di moderazione (es. "feed-posts") nel tipo di contenuto: l'enum si
 * chiama FEED_POST, quindi la conversione predefinita di Spring non basta.
 */
@Component
public class ModeratedContentTypeConverter implements Converter<String, ModeratedContentType> {

    @Override
    public ModeratedContentType convert(String source) {
        return ModeratedContentType.fromPath(source);
    }
}
