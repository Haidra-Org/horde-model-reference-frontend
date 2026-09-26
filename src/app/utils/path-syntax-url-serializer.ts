import { DefaultUrlSerializer, UrlSerializer, UrlTree } from '@angular/router';

/**
 * Routes whose last parameter is a model name. Names carry slashes
 * ("koboldcpp/Marx-3B-V3", "ViT-L/14") and parentheses ("AlbedoBase XL
 * (SDXL)"), so on these routes everything after the prefix is the name, not
 * more path.
 */
const NAME_ROUTES = /^(\/categories\/[^/?#]+\/(?:model|edit)\/)(.+)$/;

/**
 * Characters the default parser gives a meaning of their own inside a path:
 * a slash ends the segment, parentheses open an auxiliary-outlet group and a
 * semicolon starts matrix parameters.
 */
const PATH_SYNTAX = /[/();]/g;

function percentEncode(text: string): string {
  return text.replace(PATH_SYNTAX, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

/**
 * The router's own links percent-encode a model name, so in-app navigation
 * carries it as one segment. A shared link, a bookmark or a reload goes
 * through the host first, which redirects the encoded form back to the bare
 * characters, and the default parser then reads a slash as a new segment and
 * a parenthesis as outlet syntax: the name arrives cut short and the page
 * reports the model missing. Encoding the name's characters before the
 * default parser sees the URL makes both forms load. The query string and
 * fragment are left alone, since the parser treats them as plain text.
 */
export class PathSyntaxUrlSerializer implements UrlSerializer {
  private readonly inner = new DefaultUrlSerializer();

  parse(url: string): UrlTree {
    const end = url.search(/[?#]/);
    const path = end === -1 ? url : url.slice(0, end);
    const rest = end === -1 ? '' : url.slice(end);
    const named = NAME_ROUTES.exec(path);
    const encoded = named
      ? `${named[1]}${percentEncode(named[2])}`
      : path.replace(/[();]/g, (char) => percentEncode(char));
    return this.inner.parse(encoded + rest);
  }

  serialize(tree: UrlTree): string {
    return this.inner.serialize(tree);
  }
}
