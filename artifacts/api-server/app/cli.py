import argparse
import getpass
import sys

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import User, UserRole


def create_user(email: str, full_name: str, role: UserRole) -> None:
    password = getpass.getpass("Initial password (minimum 12 characters): ")
    confirmation = getpass.getpass("Confirm password: ")
    if password != confirmation or len(password) < 12:
        raise SystemExit("Passwords must match and contain at least 12 characters.")
    with SessionLocal() as db:
        if db.scalar(select(User).where(User.email == email.lower())):
            raise SystemExit("A user with that email already exists.")
        db.add(
            User(
                email=email.lower(),
                full_name=full_name.strip(),
                role=role,
                password_hash=hash_password(password),
            )
        )
        db.commit()
    print(f"Created {role.value} account for {email.lower()}.")


def main() -> None:
    parser = argparse.ArgumentParser(prog="mediflow-api")
    commands = parser.add_subparsers(dest="command", required=True)
    create = commands.add_parser("create-user", help="Create a staff login interactively.")
    create.add_argument("--email", required=True)
    create.add_argument("--full-name", required=True)
    create.add_argument("--role", choices=[role.value for role in UserRole], required=True)
    args = parser.parse_args()
    try:
        if args.command == "create-user":
            create_user(args.email, args.full_name, UserRole(args.role))
    except KeyboardInterrupt:
        sys.exit(130)


if __name__ == "__main__":
    main()
