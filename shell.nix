with (import <nixpkgs> {});

mkShell {
  name = "web";

  buildInputs = [
    nodejs yarn cypress
  ];

  CYPRESS_RUN_BINARY = "${cypress}/bin/Cypress";
  CYPRESS_INSTALL_BINARY = 0;
}
